import { HttpError, config, logger } from '../utils/index.js'

/**
 * Google Gemini generateContent (https://ai.google.dev/api/generate-content), called over plain fetch.
 * Takes the same [{ role: 'system' | 'user' | 'assistant', content }] conversation the rest of the service uses.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/** On a per-minute rate limit, wait this long at most (seconds) for Gemini's suggested retry before giving up */
const MAX_RETRY_WAIT_SECONDS = 20

/** Whether GEMINI_API_KEY is set, so callers can hide AI features instead of failing */
export const isConfigured = () => Boolean(config.gemini.apiKey)

/**
 * Sends a conversation and returns the model's whole reply text.
 * options: { temperature?: number, json?: boolean } (json asks Gemini for a JSON-only reply)
 */
export async function chat(messages, options = {}) {
  const data = await send(payload(messages, options))
  const candidate = data?.candidates?.[0]
  if (!candidate) {
    const blocked = data?.promptFeedback?.blockReason
    throw new HttpError(502, `The AI service could not answer${blocked ? ` (blocked: ${blocked})` : ''}.`)
  }
  // Thinking models may return their thoughts as separate parts flagged thought: true; keep only the answer
  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  return text.trim()
}

function payload(messages, { temperature, json } = {}) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content ?? '') }] }))

  const generationConfig = {}
  if (temperature !== undefined) generationConfig.temperature = temperature
  if (json) generationConfig.responseMimeType = 'application/json'

  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig,
  }
}

async function send(body, retried = false) {
  const key = config.gemini.apiKey
  if (!key) throw new HttpError(503, 'AI Assistance is not configured. Set GEMINI_API_KEY in the server .env file.')

  let response
  let text
  try {
    response = await fetch(`${BASE_URL}/models/${encodeURIComponent(config.gemini.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.gemini.timeout * 1000),
    })
    text = await response.text()
  } catch {
    // Connection refused, DNS failure or the timeout
    throw new HttpError(502, "Can't reach the AI service right now. Try again in a moment.")
  }

  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }

  const status = data?.error?.status
  const reason = data?.error?.details?.find((d) => d?.reason)?.reason
  if (response.status === 401 || response.status === 403 || reason === 'API_KEY_INVALID') {
    throw new HttpError(503, 'The AI service rejected the API key. Check GEMINI_API_KEY in the server .env file.')
  }
  if (response.status === 429 || status === 'RESOURCE_EXHAUSTED') {
    const details = data?.error?.details ?? []
    const quotaIds = details.flatMap((d) => d?.violations ?? []).map((v) => String(v?.quotaId ?? ''))
    const retrySeconds = parseFloat(details.find((d) => d?.retryDelay)?.retryDelay ?? '') || null
    logger.warn(`Gemini 429: ${data?.error?.message ?? 'no message'} [${quotaIds.join(', ')}] retry in ${retrySeconds ?? '?'}s`)

    // Per-minute limit with a short wait: wait it out and try once more instead of failing the chat
    if (!retried && !quotaIds.some((id) => /PerDay/i.test(id)) && retrySeconds !== null && retrySeconds <= MAX_RETRY_WAIT_SECONDS) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(retrySeconds * 1000) + 500))
      return send(body, true)
    }
    if (quotaIds.some((id) => /PerDay/i.test(id))) {
      throw new HttpError(429, "Today's free AI quota is used up. It resets at midnight Pacific time; try again then.")
    }
    const wait = retrySeconds ? ` Try again in about ${Math.ceil(retrySeconds)} seconds.` : ' Try again in a minute.'
    throw new HttpError(429, `The AI service is getting too many requests right now.${wait}`)
  }
  if (response.status === 404) {
    throw new HttpError(503, `The AI model "${config.gemini.model}" was not found. Check GEMINI_MODEL in the server .env file.`)
  }
  if (response.status < 200 || response.status >= 300) {
    const message = data?.error?.message
    throw new HttpError(502, `The AI service could not answer: ${message ? String(message) : `unexpected response (${response.status}).`}`)
  }
  return data
}
