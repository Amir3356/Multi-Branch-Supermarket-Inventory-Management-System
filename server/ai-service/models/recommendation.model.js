import { HttpError, limit } from '../utils/index.js'
import { truthy } from '../utils/dataUtils.js'

export const MAX_RECOMMENDATIONS = 6

const PRIORITIES = ['high', 'medium', 'low']

const isRecordOrArray = (value) => value !== null && typeof value === 'object'
const values = (value) => (Array.isArray(value) ? value : Object.values(value))

function toStringVal(value) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'object') return 'Array'
  return String(value)
}

const trimStr = (text) => text.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '')

const clean = (value, max) => limit(trimStr(toStringVal(isRecordOrArray(value) ? '' : value)), max)

/**
 * The AI's reply as { summary, recommendations }. Models don't always honour the JSON format: accept a fenced or
 * wrapped object, and tidy every field.
 */
export function parseRecommendations(reply) {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  let data = null
  if (start !== -1 && end > start) {
    try {
      data = JSON.parse(reply.slice(start, end + 1))
    } catch {
      data = null
    }
  }
  if (!isRecordOrArray(data) || !isRecordOrArray(data.recommendations)) {
    throw new HttpError(502, 'The AI service answered in an unexpected format. Try again.')
  }

  const items = values(data.recommendations)
    .filter((r) => isRecordOrArray(r) && trimStr(toStringVal(r.title ?? '')) !== '')
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r) => {
      const category = clean(r.category ?? 'General', 30)
      return {
        title: clean(r.title, 120),
        detail: clean(r.detail ?? '', 500),
        priority: PRIORITIES.includes(r.priority) ? r.priority : 'medium',
        category: truthy(category) ? category : 'General',
        action: clean(r.action ?? '', 120),
      }
    })

  return { summary: clean(data.summary ?? '', 400), recommendations: items }
}
