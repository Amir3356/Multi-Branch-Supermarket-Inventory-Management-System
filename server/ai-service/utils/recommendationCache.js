import * as shared from './cache.js'

/**
 * Recommendations per user (see services/ai.service.js), kept for `ttlSeconds` so opening the page again doesn't spend
 * another AI request. Stored in Redis (shared, survives restarts); while Redis is unavailable this service's memory
 * holds them instead, so a cache problem never costs extra Gemini calls.
 */
const memory = new Map()

export async function getRecommendations(key) {
  const fromRedis = await shared.get(key)
  if (fromRedis !== undefined) return fromRedis
  const hit = memory.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  memory.delete(key)
  return undefined
}

export async function putRecommendations(key, value, ttlSeconds) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  await shared.set(key, value, ttlSeconds)
}
