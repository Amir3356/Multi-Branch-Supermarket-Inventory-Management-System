import { trace } from '@opentelemetry/api'
import { traceHeaders } from '../utils/tracing.js'
import { HEADERS, encodeContext } from '../utils/index.js'
import { introspect as introspectToken } from '../services/introspection.service.js'

/**
 * The nginx gateway's sign-in check, over HTTP because nginx's auth_request can only call HTTP. The other internal
 * calls auth-service answers (Introspect, IssueToken, EndAllSessions, DeleteAllSessions) are gRPC: see
 * controllers/internal.grpc.js.
 */

function extractToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '')
  if (match) return match[1].trim()

  const cookieHeader = req.get('cookie') ?? ''
  for (const part of cookieHeader.split(';')) {
    const [key, ...values] = part.trim().split('=')
    if (key === 'auth_token' || key === 'token') {
      return decodeURIComponent(values.join('='))
    }
  }
  return null
}

/**
 * GET /internal/auth/gateway-check: the nginx gateway's auth_request. nginx sends the browser's Authorization header,
 * Cookie header and IP; the answer is always 204 (guests pass too: each service decides whether a route needs sign-in), with
 * x-auth-context set to the signed-in user when the token is valid. nginx forwards that header to the service.
 */
export async function gatewayCheck(req, res) {
  // This check is the first step of every API request, so its span is the trace's root: named after the request the
  // browser made, and handed back to the gateway (traceparent) to pass on to the service that handles it
  const span = trace.getActiveSpan()
  const method = req.get('x-original-method')
  const uri = req.get('x-original-uri')
  if (span && method && uri) {
    const path = uri.split('?')[0].replace(/\/[^/]*\d[^/]*/g, '/:id')
    res.locals.spanName = `${method} ${path}`
    span.setAttribute('app.gateway_check', true)
    span.setAttribute('url.full_path', uri.split('?')[0])
  }
  res.set(traceHeaders())
  const token = extractToken(req)
  if (token) {
    const result = await introspectToken({ token, ip: req.clientIp, touch: true })
    if (result?.user) res.set(HEADERS.CONTEXT, encodeContext({ user: result.user, tokenId: result.tokenId }))
  }
  res.status(204).end()
}

