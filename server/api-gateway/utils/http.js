/** The bearer token of a request, or null */
export function bearerToken(req) {
  const header = req.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/** TRUSTED_PROXIES for Express's 'trust proxy': empty = trust none (req.ip is the direct peer), "*" = all, else a list */
export function parseTrustedProxies(value) {
  if (!value) return false
  if (value.trim() === '*') return true
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
