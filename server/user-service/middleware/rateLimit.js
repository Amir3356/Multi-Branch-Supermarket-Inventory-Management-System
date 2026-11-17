import { MemoryStore, rateLimit } from 'express-rate-limit'
import { redis } from '../utils/cache.js'

/**
 * Laravel-style throttle:max,minutes middleware, per visitor IP (as forwarded by the gateway) and, when signed in, per user.
 *   router.post('/forgot-password', throttle(5, 1, 'password-reset'), handler)
 * Counts are kept in Redis, so they are shared by every copy of a service and survive a restart; while Redis is
 * unavailable they fall back to this service's memory.
 */
export function throttle(max, minutes = 1, name = 'default') {
  return rateLimit({
    windowMs: minutes * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `${name}:${req.user?.id ?? req.clientIp ?? req.ip}`,
    handler: (req, res) => res.status(429).json({ message: 'Too Many Attempts.' }),
    store: new RedisOrMemoryStore(),
    validate: false,
  })
}

/** express-rate-limit store: Redis when connected, else memory */
class RedisOrMemoryStore {
  constructor() {
    this.memory = new MemoryStore()
    this.prefix = 'rate-limit:'
  }

  init(options) {
    this.windowMs = options.windowMs
    this.memory.init(options)
  }

  async increment(key) {
    const r = redis()
    if (r) {
      try {
        const k = this.prefix + key
        const totalHits = await r.incr(k)
        if (totalHits === 1) await r.pExpire(k, this.windowMs)
        const ttl = await r.pTTL(k)
        return { totalHits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) }
      } catch {
        // Fall through to memory
      }
    }
    return this.memory.increment(key)
  }

  async decrement(key) {
    const r = redis()
    if (r) await r.decr(this.prefix + key).catch(() => {})
    else await this.memory.decrement(key)
  }

  async resetKey(key) {
    const r = redis()
    if (r) await r.del(this.prefix + key).catch(() => {})
    await this.memory.resetKey(key)
  }
}
