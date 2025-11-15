import { toDateKey } from '../../../utils'
import { INVENTORY_STATUSES } from '../../../utils/stock'
import { EXPENSE_CATEGORIES } from '../../expenses/model/expense'
import { inPeriod } from './periods'

// The Inventory Officer's dashboard charts, worked out from the same branch data as the cards.
// Stock charts show the shelf right now; Expenses and Damage follow the chosen period.

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0)
const day = (key) => new Date(`${key}T00:00:00`)
const short = (key, opts) => day(key).toLocaleDateString('en-US', opts)

/** Splits [from, to] into chart columns: days up to a month, weeks up to ~4 months, months beyond */
export function periodBuckets([from, to]) {
  const days = Math.round((day(to) - day(from)) / 86400000) + 1
  const buckets = []
  // A range over more than one year shows the year on month labels
  const monthFormat = from.slice(0, 4) === to.slice(0, 4) ? { month: 'short' } : { month: 'short', year: '2-digit' }
  if (days <= 31 || days > 120) {
    const byMonth = days > 120
    const cursor = day(from)
    while (toDateKey(cursor) <= to) {
      const start = toDateKey(cursor)
      if (byMonth) cursor.setMonth(cursor.getMonth() + 1, 1)
      else cursor.setDate(cursor.getDate() + 1)
      cursor.setDate(cursor.getDate() - 1)
      const end = toDateKey(cursor) < to ? toDateKey(cursor) : to
      cursor.setDate(cursor.getDate() + 1)
      buckets.push({ from: start, to: end, label: byMonth ? short(start, monthFormat) : short(start, { month: 'short', day: 'numeric' }) })
    }
    return buckets
  }
  const cursor = day(from)
  while (toDateKey(cursor) <= to) {
    const start = toDateKey(cursor)
    cursor.setDate(cursor.getDate() + 6)
    const end = toDateKey(cursor) < to ? toDateKey(cursor) : to
    cursor.setDate(cursor.getDate() + 1)
    buckets.push({ from: start, to: end, label: short(start, { month: 'short', day: 'numeric' }) })
  }
  return buckets
}

/** How many inventory batches are in each status */
export const stockStatusBreakdown = (inventory) =>
  INVENTORY_STATUSES.map((status) => ({ label: status, value: inventory.filter((i) => i.inventoryStatus === status).length }))

/** Products with the fewest units on hand (all batches of a product together), lowest first */
export function lowestStock(inventory, limit = 8) {
  const byProduct = new Map()
  for (const i of inventory) byProduct.set(i.name, (byProduct.get(i.name) || 0) + Math.max(0, i.stock))
  return [...byProduct].map(([label, value]) => ({ label, value })).sort((a, b) => a.value - b.value || a.label.localeCompare(b.label)).slice(0, limit)
}

/** Expenses and damage loss (both money) per column of the period */
export const spendingOverTime = ({ expenses, damaged }, range) =>
  periodBuckets(range).map((b) => ({
    label: b.label,
    title: b.from === b.to ? b.from : `${b.from} – ${b.to}`,
    values: [
      sum(expenses.filter((e) => inPeriod(e.date, [b.from, b.to])), (e) => e.amount),
      sum(damaged.filter((d) => inPeriod(d.date, [b.from, b.to])), (d) => d.lossValue || 0)
    ]
  }))

/** Money spent per expense category in the period, largest first; every category is listed, even at 0 */
export function expensesByCategory(expenses, range) {
  const totals = new Map(EXPENSE_CATEGORIES.map((c) => [c, 0]))
  for (const e of expenses.filter((x) => inPeriod(x.date, range))) totals.set(e.category, (totals.get(e.category) || 0) + e.amount)
  return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
