import { introspect } from '../services/auth.service.js'
import { HEADERS, bearerToken, config, encodeContext, logger } from '../utils/index.js'

/**
 * Identifies the caller before the request is proxied. Anything a browser sent in the internal headers is dropped
 * first, so it can't pretend to be someone else; then the request gets the internal secret, the visitor's IP and, when
 * the bearer token is valid, x-auth-context with the signed-in user. Guests pass through: each service decides
 * whether a route needs sign-in.
 */
export async function authenticate(req, res, next) {
  delete req.headers[HEADERS.SECRET]
  delete req.headers[HEADERS.CONTEXT]
  delete req.headers[HEADERS.CLIENT_IP]

  req.headers[HEADERS.SECRET] = config.internalSecret
  req.headers[HEADERS.CLIENT_IP] = req.ip

  const token = bearerToken(req)
  if (!token) return next()

  try {
    const result = await introspect({ token, ip: req.ip, userAgent: req.get('user-agent') ?? null })
    if (result?.user) req.headers[HEADERS.CONTEXT] = encodeContext({ user: result.user, tokenId: result.tokenId })
    next()
  } catch (error) {
    // Without auth-service no one can be identified: say so instead of answering as if signed out
    logger.error('Token check failed', { error: error.message })
    res.status(503).json({ message: 'Sign-in checks are unavailable right now. Try again shortly.' })
  }
}
