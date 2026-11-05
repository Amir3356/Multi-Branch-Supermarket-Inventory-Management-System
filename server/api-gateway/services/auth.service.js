import { serviceClient } from '../utils/index.js'

const auth = serviceClient('auth')

/**
 * Who a bearer token belongs to: { user, tokenId }, or { user: null }. auth-service also records the session's
 * activity, and ends it if it timed out. Throws when auth-service can't be reached.
 */
export function introspect({ token, ip, userAgent }) {
  return auth.post('/internal/auth/introspect', { token, ip, userAgent, touch: true }, { timeoutMs: 5_000 })
}
