import path from 'node:path'
import { fileURLToPath } from 'node:url'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import client from 'prom-client'
import { config } from './config.js'
import { HEADERS, decodeContext, isInternalSecret } from './context.js'
import { HttpError } from './errors.js'
import { logger } from './logger.js'
import { registry } from './metrics.js'
import { SpanKind, contextFrom, traceHeaders, traced } from './tracing.js'

/**
 * Service-to-service calls over gRPC (contract: proto/supermarket.proto, loaded at start-up, no generated code).
 *
 * Server: createService({ grpc: { Inventory: { TakeStock: async (request, ctx) => reply } } }) serves the handlers;
 *   ctx is the caller as REST handlers see it: { user, tokenId, clientIp, userAgent }.
 * Client: await grpcClient('inventory').call('TakeStock', request, { req })
 *   req forwards the signed-in user (as metadata). A failure is thrown as the same HttpError the other
 *   service raised (status, message, field errors), so it reaches the browser unchanged.
 *
 * Every call carries x-internal-secret, is a span of the current trace (traceparent in metadata) and is counted in
 * grpc_server_handled_total / grpc_server_handling_seconds for Grafana.
 */

const PROTO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'proto', 'supermarket.proto')
const definition = protoLoader.loadSync(PROTO_PATH, { keepCase: false, longs: Number, enums: String, defaults: true, oneofs: true })
const proto = grpc.loadPackageDefinition(definition).supermarket.internal.v1

// Which service serves which gRPC service
const SERVICE_OF = { inventory: 'Inventory', procurement: 'Procurement', auth: 'Auth', notification: 'Notification' }

// HTTP status ↔ gRPC status code
const TO_GRPC = { 400: 'INVALID_ARGUMENT', 401: 'UNAUTHENTICATED', 403: 'PERMISSION_DENIED', 404: 'NOT_FOUND', 409: 'ALREADY_EXISTS', 422: 'FAILED_PRECONDITION', 429: 'RESOURCE_EXHAUSTED', 502: 'UNAVAILABLE', 503: 'UNAVAILABLE', 504: 'DEADLINE_EXCEEDED' }

const handled = new client.Counter({
  name: 'grpc_server_handled_total',
  help: 'gRPC calls this service answered, by method and status code',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_code'],
  registers: [registry],
})
const handling = new client.Histogram({
  name: 'grpc_server_handling_seconds',
  help: 'How long this service took to answer gRPC calls',
  labelNames: ['grpc_service', 'grpc_method'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
})
const sent = new client.Counter({
  name: 'grpc_client_calls_total',
  help: 'gRPC calls this service made to other services, by target, method and status code',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_code'],
  registers: [registry],
})

const first = (metadata, key) => {
  const value = metadata.get(key)[0]
  return value === undefined ? null : Buffer.isBuffer(value) ? value.toString('utf8') : String(value)
}

// ---- Server -------------------------------------------------------------------------------------------------------

let server = null

/**
 * Starts this service's gRPC server on the port of its own *_GRPC_URL, serving `handlers`:
 *   { Inventory: { TakeStock: async (request, ctx) => reply, … } }
 */
export function startGrpcServer(key, handlers) {
  const target = config.grpc?.[key]
  if (!target || server) return null
  server = new grpc.Server()
  for (const [serviceName, methods] of Object.entries(handlers)) {
    const implementation = {}
    for (const [method, handler] of Object.entries(methods)) {
      implementation[method] = (call, callback) => handle(serviceName, method, handler, call, callback)
    }
    server.addService(proto[serviceName].service, implementation)
  }
  const port = Number(String(target).split(':').pop())
  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
    if (error) logger.error(`gRPC server not started on :${port}`, { error: error.message })
    else logger.info(`gRPC listening on :${port} (${Object.keys(handlers).join(', ')})`)
  })
  return server
}

export function stopGrpcServer() {
  return new Promise((resolve) => (server ? server.tryShutdown(() => resolve()) : resolve()))
}

// Never throws: anything unexpected becomes an INTERNAL reply instead of crashing the service
function handle(serviceName, method, handler, call, callback) {
  answer(serviceName, method, handler, call, callback).catch((error) => {
    logger.error(`gRPC ${serviceName}/${method} could not answer`, { error: error?.message })
    try {
      callback({ code: grpc.status.INTERNAL, details: 'Server Error' })
    } catch {
      // The call is already closed
    }
  })
}

async function answer(serviceName, method, handler, call, callback) {
  const end = handling.startTimer({ grpc_service: serviceName, grpc_method: method })
  const done = (code, error, reply) => {
    end()
    handled.inc({ grpc_service: serviceName, grpc_method: method, grpc_code: code })
    callback(error, reply)
  }
  const md = call.metadata
  if (!isInternalSecret(first(md, HEADERS.SECRET))) {
    return done('PERMISSION_DENIED', { code: grpc.status.PERMISSION_DENIED, details: 'Only other services may call this.' })
  }
  const context = decodeContext(first(md, HEADERS.CONTEXT))
  const ctx = { user: context?.user ?? null, tokenId: context?.tokenId ?? null, clientIp: first(md, HEADERS.CLIENT_IP), userAgent: first(md, 'user-agent') }
  const carrier = { traceparent: first(md, 'traceparent') ?? undefined, tracestate: first(md, 'tracestate') ?? undefined }

  try {
    const reply = await traced(`grpc ${serviceName}/${method}`, {
      kind: SpanKind.SERVER,
      parent: contextFrom(carrier),
      attributes: { 'rpc.system': 'grpc', 'rpc.service': serviceName, 'rpc.method': method },
    }, () => handler(call.request, ctx))
    done('OK', null, reply ?? {})
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const codeName = TO_GRPC[status] ?? 'INTERNAL'
    if (!(error instanceof HttpError)) logger.error(`gRPC ${serviceName}/${method} failed`, { error: error?.message })
    const trailer = new grpc.Metadata()
    trailer.set('http-status', String(status))
    // Binary (-bin) metadata: messages may hold any UTF-8 (e.g. "isn’t", Amharic), which text metadata refuses
    trailer.set('error-body-bin', Buffer.from(JSON.stringify(error instanceof HttpError ? error.toJSON() : { message: 'Server Error' }), 'utf8'))
    // `details` travels as text too: keep it plain ASCII; the full message is in error-body-bin
    const details = (error instanceof HttpError ? error.message : 'Server Error').normalize('NFKD').replace(/[^\x20-\x7e]/g, '?')
    done(codeName, { code: grpc.status[codeName], details, metadata: trailer })
  }
}

// ---- Client -------------------------------------------------------------------------------------------------------

const clients = new Map()

function stub(name) {
  if (!clients.has(name)) {
    const serviceName = SERVICE_OF[name]
    const target = config.grpc?.[name]
    if (!serviceName || !target) throw new Error(`Unknown gRPC service "${name}"`)
    clients.set(name, new proto[serviceName](target, grpc.credentials.createInsecure()))
  }
  return clients.get(name)
}

/** The metadata of an outgoing call: the internal secret, the signed-in caller (from req) and the trace */
function metadataFor(req) {
  const md = new grpc.Metadata()
  md.set(HEADERS.SECRET, config.internalSecret)
  const context = req?.get?.(HEADERS.CONTEXT)
  if (context) md.set(HEADERS.CONTEXT, context)
  if (req?.clientIp) md.set(HEADERS.CLIENT_IP, req.clientIp)
  if (req?.userAgent) md.set('user-agent', req.userAgent)
  for (const [key, value] of Object.entries(traceHeaders())) md.set(key, value)
  return md
}

/** A client for another service's gRPC API: grpcClient('inventory').call('TakeStock', request, { req, timeoutMs }) */
export function grpcClient(name) {
  const serviceName = SERVICE_OF[name]
  return {
    call: (method, request, { req, timeoutMs = 10_000 } = {}) =>
      traced(`grpc ${serviceName}/${method}`, {
        kind: SpanKind.CLIENT,
        attributes: { 'rpc.system': 'grpc', 'rpc.service': serviceName, 'rpc.method': method, 'server.address': `${name}-service` },
      }, () =>
        new Promise((resolve, reject) => {
          const deadline = new Date(Date.now() + timeoutMs)
          stub(name)[method](request, metadataFor(req), { deadline }, (error, reply) => {
            if (!error) {
              sent.inc({ grpc_service: serviceName, grpc_method: method, grpc_code: 'OK' })
              return resolve(reply)
            }
            const codeName = Object.keys(grpc.status).find((k) => grpc.status[k] === error.code) ?? 'UNKNOWN'
            sent.inc({ grpc_service: serviceName, grpc_method: method, grpc_code: codeName })
            const httpStatus = error.metadata && first(error.metadata, 'http-status')
            if (httpStatus) {
              let body = {}
              try {
                body = JSON.parse(first(error.metadata, 'error-body-bin') ?? '{}')
              } catch {
                body = {}
              }
              return reject(new HttpError(Number(httpStatus), body.message || error.details, body.errors))
            }
            // Not answered at all (service down, deadline passed): the same message REST calls gave
            reject(new HttpError(503, `The ${name} service is unavailable right now. Try again shortly.`, undefined, { cause: codeName }))
          })
        }),
      ),
  }
}

/** Closes the connections to other services (on shutdown) */
export function closeGrpcClients() {
  for (const c of clients.values()) c.close()
  clients.clear()
}
