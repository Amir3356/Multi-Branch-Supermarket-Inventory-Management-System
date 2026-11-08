import { DateTime } from './index.js'

/**
 * Data calculation, rounding, sorting and normalization helpers.
 */

/** Converts value to float: null, '' and non-numbers become 0; numeric strings become numbers */
export function toFloat(value) {
  if (value === null || value === undefined || value === '' || value === false) return 0
  if (value === true) return 1
  const number = Number(value)
  return Number.isNaN(number) ? 0 : number
}

/** Truncates toward zero */
export const toInt = (value) => Math.trunc(toFloat(value)) || 0

// Moves the decimal point through the string form, so 0.285 → 28.5 exactly (no binary multiplication error)
const shift = (number, places) => {
  const [mantissa, exponent = '0'] = String(number).split('e')
  return Number(`${mantissa}e${Number(exponent) + places}`)
}

/**
 * Rounds a number to the specified precision (half away from zero).
 */
export function roundNumber(value, precision = 0) {
  const number = toFloat(value)
  if (!Number.isFinite(number) || number === 0) return number === 0 ? 0 : number
  const pre = Math.abs(Number(number.toPrecision(15)))
  const rounded = shift(Math.round(shift(pre, precision)), -precision)
  return number < 0 && rounded !== 0 ? -rounded : rounded
}

/** Truthiness helper: '', '0', 0, null, false and [] are falsy */
export function truthy(value) {
  if (value === null || value === undefined || value === false || value === '' || value === '0' || value === 0) return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

const NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/

export const isNumeric = (value) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && NUMERIC.test(value))

/**
 * Compares two values for sorting (strings, numbers, null):
 * numeric strings compare as numbers, other strings byte by byte, null as empty against strings.
 */
export function compareValues(a, b) {
  if (a === undefined) a = null
  if (b === undefined) b = null
  if (a === b) return 0
  if (a === null || b === null) {
    const other = a === null ? b : a
    const sign = a === null ? -1 : 1
    if (typeof other === 'string') return other === '' ? 0 : sign
    return Boolean(other) ? sign : 0
  }
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  if (isNumeric(a) && isNumeric(b)) {
    const [x, y] = [Number(a), Number(b)]
    return x < y ? -1 : x > y ? 1 : 0
  }
  const result = Buffer.compare(Buffer.from(String(a)), Buffer.from(String(b)))
  return result < 0 ? -1 : result > 0 ? 1 : 0
}

/**
 * Stable sorting by a property or projection function.
 */
export function sortBy(items, key, descending = false) {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items
    .map((item, index) => ({ item, index, sortValue: value(item) }))
    .sort((x, y) => (descending ? compareValues(y.sortValue, x.sortValue) : compareValues(x.sortValue, y.sortValue)) || x.index - y.index)
    .map(({ item }) => item)
}

export const sortByDesc = (items, key) => sortBy(items, key, true)

/** Multi-key sorting: compares key after key until one differs */
export function sortByMany(items, comparisons) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      for (const [key, direction = 'asc'] of comparisons) {
        const result = direction === 'asc' ? compareValues(x.item[key], y.item[key]) : compareValues(y.item[key], x.item[key])
        if (result !== 0) return result
      }
      return x.index - y.index
    })
    .map(({ item }) => item)
}

/** Groups items into a Map by key */
export function groupBy(items, key) {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  const groups = new Map()
  for (const item of items) {
    const groupKey = value(item)
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(item)
  }
  return groups
}

/** Calculates the sum of a numeric property across items */
export const sum = (items, key) => {
  const value = typeof key === 'function' ? key : (item) => item?.[key]
  return items.reduce((total, item) => total + toFloat(value(item)), 0)
}

/** Timestamp rounded to whole seconds */
export function dbTime(value) {
  const millis = DateTime.isDateTime(value) ? value.toMillis() : value instanceof Date ? value.getTime() : Date.parse(value)
  return new Date(Math.floor(millis / 1000) * 1000)
}

export const isoInZone = (dateTime) => dateTime.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ")

export const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`

const TRIM = /^[ \t\n\r\v\f﻿​‎]+|[ \t\n\r\v\f﻿​‎]+$/g

/**
 * Trims strings and converts empty strings to null in input objects and arrays.
 */
export function cleanInput(value) {
  if (typeof value === 'string') {
    const trimmed = value.replace(TRIM, '')
    return trimmed === '' ? null : trimmed
  }
  if (Array.isArray(value)) return value.map(cleanInput)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanInput(item)]))
  return value
}

/** Builds positional parameters for a hand-written query: `where id = ${p.add(id)}` */
export class Params {
  values = []

  add(value) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}
