import { DateTime, HttpError, config } from './index.js'

/**
 * Data normalization, rounding, formatting and parsing helpers.
 */

const TRIM = /^[\s﻿​‎]+|[\s﻿​‎]+$/g
export function normalizeInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(TRIM, '')
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(normalizeInput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeInput(v)]))
  return value
}

/** Converts a value to string representation */
export function toStringVal(value) {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return '1'
  if (typeof value === 'object') return 'Array'
  return String(value)
}

/** Checks whether a string value is empty or "0" */
export const isFalsyString = (value) => value === '' || value === '0'

/** Converts value to an integer */
export function toInt(value) {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0
  if (typeof value === 'string') return Math.trunc(Number.parseFloat(value)) || 0
  return 0
}

/** Rounds a number to the specified precision (half away from zero) */
export function roundNumber(value, precision = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** precision
  const shifted = Number((Math.abs(n) * factor).toPrecision(15))
  return (Math.sign(n) || 1) * (Math.round(shifted) / factor)
}

export const ucfirst = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)

/** Returns a timestamp formatted as an ISO date string in the configured store timezone */
export function localDate(value) {
  if (!value) return null
  return DateTime.fromJSDate(value instanceof Date ? value : new Date(value), { zone: 'utc' }).setZone(config.timezone).toISODate()
}

/** Returns the current date truncated to whole seconds */
export const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000)

/** Generates a 404 HttpError for missing entities */
export const modelNotFound = (model, id) => new HttpError(404, `No query results for model [${model}] ${id}`)
