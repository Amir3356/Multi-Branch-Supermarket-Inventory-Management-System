import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

/**
 * Distributed tracing (OpenTelemetry). Every request becomes a trace: one span per step (this service's handling,
 * calls to other services, PostgreSQL queries, Redis lookups, Kafka events), all sharing one trace id that travels
 * in the W3C `traceparent` header (HTTP) and in Kafka message headers. Spans are sent to Grafana Tempo over OTLP and
 * viewed in Grafana.
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT  where Tempo listens (docker compose: http://tempo:4318); empty = tracing off
 *   TRACE_SAMPLE_RATIO           share of new traces kept, 0..1 (default 1 = all)
 */

let provider = null
export { SpanKind }

/** Starts tracing for this service (createService calls it with the service name); no-op without an endpoint */
export function initTracing(serviceName) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (provider || !endpoint) return
  const ratio = Number(process.env.TRACE_SAMPLE_RATIO ?? '1')
  provider = new NodeTracerProvider({
    resource: new Resource({ [SEMRESATTRS_SERVICE_NAME]: serviceName }),
    // A trace started upstream keeps its decision; new traces are sampled at TRACE_SAMPLE_RATIO
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 1) }),
  })
  provider.addSpanProcessor(
    new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }), { scheduledDelayMillis: 2_000 }),
  )
  // AsyncLocalStorage context and W3C trace-context propagation
  provider.register()
}

/** Sends the spans still waiting (on shutdown) */
export async function shutdownTracing() {
  await provider?.shutdown().catch(() => {})
}

const tracer = () => trace.getTracer('supermarket')

/** Whether code is running inside a traced request or event (background work isn't traced on its own) */
export const inTrace = () => Boolean(trace.getActiveSpan())

/** Runs fn(span) inside a new span; errors mark the span and are rethrown */
export async function traced(name, { kind = SpanKind.INTERNAL, attributes = {}, parent } = {}, fn) {
  const parentContext = parent ?? context.active()
  const span = tracer().startSpan(name, { kind, attributes }, parentContext)
  return context.with(trace.setSpan(parentContext, span), async () => {
    try {
      return await fn(span)
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message })
      throw error
    } finally {
      span.end()
    }
  })
}

/** The current trace context as headers ({ traceparent }), to pass on to another service or into a Kafka message */
export function traceHeaders() {
  const carrier = {}
  propagation.inject(context.active(), carrier)
  return carrier
}

/** The trace context carried by incoming headers (HTTP or Kafka; Buffer values are read as text) */
export function contextFrom(headers = {}) {
  const carrier = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) carrier[key.toLowerCase()] = Buffer.isBuffer(value) ? value.toString('utf8') : String(value)
  }
  return propagation.extract(context.active(), carrier)
}

/**
 * Express middleware: one SERVER span per request, continuing the trace the gateway or calling service started. The
 * span is named after the matched route (GET /branches/:branch) and records the status and the signed-in user.
 */
export function tracingMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/health') return next()
  const parent = contextFrom(req.headers)
  const span = tracer().startSpan(
    `${req.method} ${req.path}`,
    { kind: SpanKind.SERVER, attributes: { 'http.request.method': req.method, 'url.path': req.path } },
    parent,
  )
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : null
    if (route) span.setAttribute('http.route', route)
    // A handler may name its span itself (the gateway check names it after the browser's request)
    if (res.locals.spanName) span.updateName(res.locals.spanName)
    else if (route) span.updateName(`${req.method} ${route}`)
    span.setAttribute('http.response.status_code', res.statusCode)
    if (req.user) {
      span.setAttribute('enduser.id', String(req.user.id))
      span.setAttribute('enduser.role', String(req.user.role))
      if (req.user.branchId) span.setAttribute('app.branch_id', String(req.user.branchId))
    }
    if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR })
    span.end()
  })
  context.with(trace.setSpan(parent, span), next)
}
