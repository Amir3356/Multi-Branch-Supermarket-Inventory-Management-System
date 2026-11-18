import { validate } from '../utils/index.js'
import { issueTokenSchema, userSessionsSchema } from '../middleware/validators/internal.validator.js'
import { introspect as introspectToken } from '../services/introspection.service.js'
import * as sessions from '../services/session.service.js'
import * as tokens from '../services/token.service.js'

/**
 * auth-service's internal gRPC API (service Auth in proto/supermarket.proto). The gateway's own sign-in check stays
 * HTTP (GET /internal/auth/gateway-check), because nginx's auth_request can only call HTTP.
 */
export const authGrpc = {
  Auth: {
    /** Who a token belongs to; no `user` in the reply = not signed in */
    async Introspect(request) {
      if (!request.token) return {}
      const result = await introspectToken({ token: request.token, ip: request.ip || null, touch: request.touch === true })
      return result?.user ? { user: result.user, tokenId: result.tokenId } : {}
    },

    /** Signs a user in right after they accepted their invitation (ctx carries their browser and IP) */
    async IssueToken(request, ctx) {
      const { userId } = validate(issueTokenSchema, { userId: request.userId })
      const { token, user } = await tokens.issueFor(userId, ctx)
      return { token, userJson: JSON.stringify(user) }
    },

    /** Ends every open session of the user (account deactivated) */
    async EndAllSessions(request) {
      const { userId, reason } = validate(userSessionsSchema, { userId: request.userId, reason: request.reason })
      return { count: await sessions.endAllFor(userId, reason) }
    },

    /** Removes every session of the user (account deleted) */
    async DeleteAllSessions(request) {
      const { userId, reason } = validate(userSessionsSchema, { userId: request.userId, reason: request.reason })
      return { count: await sessions.deleteAllFor(userId, reason) }
    },
  },
}
