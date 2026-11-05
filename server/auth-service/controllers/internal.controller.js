import { introspect as introspectToken } from '../services/introspection.service.js'
import * as sessions from '../services/session.service.js'
import * as tokens from '../services/token.service.js'

/**
 * Service-to-service (never routed by the gateway):
 *   POST /internal/auth/introspect     { token, ip?, userAgent?, touch } → { user, tokenId } | { user: null }
 *   POST /internal/auth/issue-token    { userId } (forwarded req)        → { token, user }
 *   POST /internal/sessions/end-all    { userId, reason }                → { ended }
 *   POST /internal/sessions/delete-all { userId, reason }                → { deleted }
 * Bodies of the last three are parsed by middleware/validators/internal.validator.js.
 */

export async function introspect(req, res) {
  const body = req.body ?? {}
  if (typeof body.token !== 'string' || body.token === '') return res.json({ user: null })

  const result = await introspectToken({
    token: body.token,
    ip: typeof body.ip === 'string' && body.ip !== '' ? body.ip : null,
    touch: body.touch === true,
  })
  res.json(result ?? { user: null })
}

/** Signs a user in right after another service proved who they are (an accepted invitation) */
export async function issueToken(req, res) {
  res.json(await tokens.issueFor(req.body.userId, req))
}

/** Ends every open session of the user (account deactivated), tells their browsers and refreshes the Owner's list */
export async function endAllSessions(req, res) {
  res.json({ ended: await sessions.endAllFor(req.body.userId, req.body.reason) })
}

/** Same, but removes the rows (account deleted) */
export async function deleteAllSessions(req, res) {
  res.json({ deleted: await sessions.deleteAllFor(req.body.userId, req.body.reason) })
}
