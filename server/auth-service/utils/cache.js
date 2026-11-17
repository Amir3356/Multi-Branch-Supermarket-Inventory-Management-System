import { createClient } from 'redis'
import { config } from './config.js'
import { logger } from './logger.js'
import { cacheRequests } from './metrics.js'
import { SpanKind, inTrace, traced } from './tracing.js'

/**
 * The shared cache (Redis): data read often and changed rarely is kept here, so it doesn't hit the database on every
 * request. Every service talks to the same Redis, so one service can clear what another cached (e.g. user-service
 * clears auth-service's copy of a user it just changed).
 *
 * Redis is optional: with REDIS_URL empty, or while Redis is unreachable, every call simply reads from the database
 * (remember() runs its loader) and writes are skipped. A cache problem never fails a request.
 *
 *   const branches = await cache.remember('branches:list', 600, () => repository.all())
 *   await cache.forget('branches:list')
 */

let client = null
let ready = false
let warned = false

function connect() {
  if (client || !config.redisUrl) return
  client = createClient({
    url: config.redisUrl,
    // While Redis is down, commands fail at once instead of queueing, so requests fall back to the database
    disableOfflineQueue: true,
    socket: { connectTimeout: 2_000, reconnectStrategy: (attempt) => Math.min(attempt * 500, 10_000) },
  })
  client.on('ready', () => {
    ready = true
    if (warned) logger.info('Cache (Redis) is back')
    warned = false
  })
  client.on('end', () => {
    ready = false
  })
  client.on('error', (error) => {
    ready = false
    if (!warned) logger.warn('Cache (Redis) unavailable; reading from the database', { error: error.message })
    warned = true
  })
  client.connect().catch(() => {})
}

/** The connected Redis client, or null while there is none (callers then fall back) */
export function redis() {
  connect()
  return ready ? client : null
}

// Tracing: inside a traced request each Redis call is a span (cache hit or miss attached)
const redisSpan = (command, key, fn) =>
  inTrace() ? traced(`redis ${command}`, { kind: SpanKind.CLIENT, attributes: { 'db.system': 'redis', 'db.operation': command, 'app.cache_key': key } }, fn) : fn()

/** The cached value of `key`, or undefined (also when Redis is unavailable) */
export const get = (key) =>
  redisSpan('GET', key, async (span) => {
    const value = await getValue(key)
    span?.setAttribute('app.cache_hit', value !== undefined)
    return value
  })

async function getValue(key) {
  const r = redis()
  if (!r) {
    if (config.redisUrl) cacheRequests.inc({ result: 'error' })
    return undefined
  }
  try {
    const hit = await r.get(key)
    cacheRequests.inc({ result: hit === null ? 'miss' : 'hit' })
    return hit === null ? undefined : JSON.parse(hit)
  } catch {
    cacheRequests.inc({ result: 'error' })
    return undefined
  }
}

/** Caches `value` (JSON) for `ttlSeconds`; null and undefined aren't cached */
export const set = (key, value, ttlSeconds) => redisSpan('SET', key, () => setValue(key, value, ttlSeconds))

async function setValue(key, value, ttlSeconds) {
  const r = redis()
  if (!r || value === null || value === undefined) return
  await r.set(key, JSON.stringify(value), { EX: ttlSeconds }).catch(() => {})
}

/** The cached value, else load() — whose result is cached for `ttlSeconds` (null / undefined aren't) */
export async function remember(key, ttlSeconds, load) {
  const hit = await get(key)
  if (hit !== undefined) return hit
  const value = await load()
  await set(key, value, ttlSeconds)
  return value
}

/** Removes cached keys, after the data behind them changed */
export const forget = (...keys) => redisSpan('DEL', keys.join(' '), () => forgetKeys(keys))

async function forgetKeys(keys) {
  const r = redis()
  if (!r || !keys.length) return
  await r.del(keys).catch(() => {})
}
