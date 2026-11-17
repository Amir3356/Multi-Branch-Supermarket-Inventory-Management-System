import { config, toUserContext } from '../utils/index.js'
import * as repository from '../repositories/session.repository.js'
import * as users from '../repositories/user.repository.js'
import { SessionService } from './session.service.js'
import { TOKENABLE_TYPE } from '../models/session.model.js'
import { hashEquals, sha256 } from '../utils/tokens.js'
import { verifyJwt } from '../utils/jwt.js'

/**
 * JWT authentication only: the bearer token must be a JWT with a valid signature that hasn't expired, and its session
 * (tokenId) must exist with the same JWT ID (jti). Anything else, including the old "id|secret" tokens, is refused.
 */
async function findToken(plain) {
  const payload = verifyJwt(plain, config.internalSecret)
  if (!payload?.tokenId || typeof payload.jti !== 'string') return null
  const session = await repository.findCached(payload.tokenId)
  return session && hashEquals(session.token, sha256(payload.jti)) ? session : null
}

/**
 * Who a bearer JWT belongs to. Besides a valid signature and expiry (findToken), its session must be:
 *   - not past TOKEN_EXPIRATION_MINUTES since it was created, nor past its expires_at, and its user exists
 *   - not ended, and not unused past SESSION_TIMEOUT_MINUTES (then it is ended, with the inactivity reason)
 * With touch (a real API request), the request counts as activity: the IP/location are recorded (TokenAuthenticated)
 * and last_used_at is stamped.
 *
 * Returns { user, tokenId } or null.
 */
/** How often a session in use gets its last_used_at stamped */
const TOUCH_EVERY_SECONDS = 30

export async function introspect({ token: plain, ip = null, touch = false }) {
  const token = await findToken(plain)
  if (!token) return null

  const user = token.tokenable_type === TOKENABLE_TYPE ? await users.findCached(token.tokenable_id) : null
  const minutes = config.tokenExpirationMinutes
  const isValid =
    (!minutes || new Date(token.created_at).getTime() > Date.now() - minutes * 60_000) &&
    (!token.expires_at || new Date(token.expires_at).getTime() > Date.now()) &&
    user !== null
  if (!isValid || token.ended_at !== null) return null

  const sessions = new SessionService()
  if (await sessions.expireIfInactive(token)) return null

  if (touch) {
    await sessions.recordActivity(token, ip)
    // Stamped at most every TOUCH_EVERY_SECONDS: plenty for the inactivity timeout, and most requests write nothing
    const lastUsed = token.last_used_at ? new Date(token.last_used_at).getTime() : 0
    if (lastUsed <= Date.now() - TOUCH_EVERY_SECONDS * 1000) await repository.touch(token.id)
  }

  return { user: toUserContext(user), tokenId: token.id }
}
