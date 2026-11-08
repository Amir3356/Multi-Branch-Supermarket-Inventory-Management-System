import { iso8601 } from '../utils/index.js'
import { recommendationCache as cache } from '../utils/recommendationCache.js'
import { brief, chatRules, recommendationRules } from '../utils/templates/aiPrompts.js'
import { parseRecommendations } from '../models/recommendation.model.js'
import { chat as askAi } from './gemini.service.js'
import { snapshotFor } from './roleSnapshot.service.js'

/**
 * AI Assistance: role-specific recommendations and a chat that answers from the same figures.
 * Each role gets its own brief and only the data its RoleSnapshot allows.
 */

/** Recommendations are kept this long per user, so opening the page doesn't call the AI every time */
const CACHE_MINUTES = 30

/** { summary, recommendations: [{ title, detail, priority, category, action }], generatedAt, cached } */
export async function recommendations(user, refresh = false) {
  const key = `ai:recommendations:${user.id}:${user.role}:${user.branchId ?? 'all'}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt <= Date.now()) cache.delete(key)
  if (!refresh && hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true }

  const snapshot = await snapshotFor(user)
  const reply = await askAi(
    [
      { role: 'system', content: `${brief(user.role)}\n\n${recommendationRules()}` },
      { role: 'user', content: `Today's figures (JSON):\n${formatJson(snapshot)}` },
    ],
    // JSON-only reply; the shape is spelled out in the rules
    { json: true, temperature: 0.3 },
  )

  const result = { ...parseRecommendations(reply), generatedAt: iso8601(new Date()) }
  cache.set(key, { value: result, expiresAt: Date.now() + CACHE_MINUTES * 60_000 })
  return { ...result, cached: false }
}

/** Answers the latest question in a conversation of [{ role: user|assistant, content }], from the role's figures */
export async function answer(user, messages) {
  const snapshot = await snapshotFor(user)
  const system = `${brief(user.role)}\n\n${chatRules()}\n\nThe figures you can use (JSON):\n${formatJson(snapshot)}`
  const reply = await askAi([{ role: 'system', content: system }, ...messages], { temperature: 0.4 })
  return reply !== '' ? reply : "I couldn't come up with an answer. Try asking in a different way."
}

/**
 * Formats value as JSON string with escaped slashes and line separators
 */
const formatJson = (value) =>
  JSON.stringify(value)
    .replace(/\//g, '\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
