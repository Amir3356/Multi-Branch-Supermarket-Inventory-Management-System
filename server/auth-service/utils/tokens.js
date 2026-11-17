import crypto from 'node:crypto'

/**
 * Helpers for the JWT sessions. Each JWT carries a random `jti` (its unique ID); the session row stores only the
 * sha256 of it (personal_access_tokens.token), so the JWT and its session are tied together one to one.
 */

/** A new random JWT ID */
export const newJwtId = () => crypto.randomUUID()

export const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex')

/** Timing-safe compare for two hex digests */
export function hashEquals(known, given) {
  const a = Buffer.from(String(known ?? ''))
  const b = Buffer.from(String(given ?? ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
