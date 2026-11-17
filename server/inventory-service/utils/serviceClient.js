import { config } from './config.js'
import { HEADERS, forwardHeaders } from './context.js'
import { HttpError } from './errors.js'
import { SpanKind, traceHeaders, traced } from './tracing.js'

/**
 * Calls another service's internal API. Errors from the other service come back as HttpError with its status and
 * body, so a 422 from inventory-service ("Only 3 units left…") reaches the browser unchanged.
 *
 *   const inventory = serviceClient('inventory')
 *   await inventory.post('/internal/stock/take', body, { req })   // req forwards the signed-in user
 */
export function serviceClient(name) {
  const baseUrl = config.services[name]
  if (!baseUrl) throw new Error(`Unknown service "${name}"`)

  // Each call is a CLIENT span of the current trace; the trace id goes along in the traceparent header
  const request = (method, path, options = {}) =>
    traced(`${method} ${name}-service ${path.replace(/\/[^/]*\d[^/]*/g, '/:id')}`, {
      kind: SpanKind.CLIENT,
      attributes: { 'http.request.method': method, 'server.address': `${name}-service`, 'url.path': path },
    }, async (span) => {
      const data = await send(method, path, options)
      span.setAttribute('http.response.status_code', 200)
      return data
    })

  async function send(method, path, { body, req, timeoutMs = 10_000, headers = {} } = {}) {
    let response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          [HEADERS.SECRET]: config.internalSecret,
          ...forwardHeaders(req),
          ...traceHeaders(),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new HttpError(503, `The ${name} service is unavailable right now. Try again shortly.`, undefined, { cause: error.name })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new HttpError(response.status, data.message || `The ${name} service could not complete the request.`, data.errors)
    }
    return data
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  }
}
