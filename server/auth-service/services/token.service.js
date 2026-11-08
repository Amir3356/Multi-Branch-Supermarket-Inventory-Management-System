import { config, limit, notFound, presentAuthUser } from '../utils/index.js'
import * as sessionRecords from '../repositories/session.repository.js'
import * as signIns from '../repositories/signIn.repository.js'
import * as users from '../repositories/user.repository.js'
import { generateSecret } from '../utils/tokens.js'
import { signJwt } from '../utils/jwt.js'
import { SessionService } from './session.service.js'

/**
 * A new API JWT token (one session) named after the browser that asked for it, plus the user payload:
 * { token, user } (AuthUserResource, not wrapped). `sessions` is the request's SessionService.
 */
export async function issue(userId, req, sessions) {
  const device = limit(req.userAgent || 'Unknown device', 120, '')

  const secret = generateSecret()
  const token = await sessionRecords.createFor(userId, device, secret)
  // Kept for access reviews of past periods
  await signIns.record(userId)
  // Shown to the Owner in Session Monitoring
  await sessions.recordAddress(token, req.clientIp)
  sessions.announce('signed-in')

  const user = await users.withBranch(userId)
  if (!user) throw notFound()

  const expiresInSeconds = (config.tokenExpirationMinutes || 10080) * 60
  const jwt = signJwt(
    {
      sub: user.id,
      tokenId: token.id,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
    },
    config.internalSecret,
    { expiresIn: expiresInSeconds }
  )

  return {
    token: jwt,
    user: presentAuthUser(user),
  }
}

/** Signs a user in right after another service proved who they are (an accepted invitation); 404 for an unknown id */
export async function issueFor(userId, req) {
  if (!(await users.find(userId))) throw notFound()
  return issue(userId, req, new SessionService())
}
