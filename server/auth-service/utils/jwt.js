import crypto from 'node:crypto'

/**
 * Standard RFC 7519 JSON Web Token (JWT) signing with HMAC SHA-256 (HS256).
 */
export function signJwt(payload, secret, { expiresIn } = {}) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const iat = Math.floor(Date.now() / 1000)
  const exp = expiresIn ? iat + expiresIn : undefined
  const fullPayload = { ...payload, iat, ...(exp !== undefined ? { exp } : {}) }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url')
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url')

  return `${data}.${signature}`
}

/**
 * Verifies a JWT's signature and expiration, returning decoded payload or null.
 */
export function verifyJwt(token, secret) {
  if (typeof token !== 'string' || !token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [encodedHeader, encodedPayload, signature] = parts
  const data = `${encodedHeader}.${encodedPayload}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
