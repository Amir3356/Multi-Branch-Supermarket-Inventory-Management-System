import { todayKey } from '../../../utils'
import { inPeriod } from './periods'

// Each role's dashboard: summary cards worked out from the app's own data (no mock data), for the branch in scope.
// Cards are { title, icon, tone, value, chip, chipTone }; `icon` is a key the page maps to an icon.

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0)
const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`

// Total Sales and Quantity Sold follow the chosen period; Today's Sales is always today
function cashierCards({ sales }, { money, today, period }) {
  const salesInPeriod = sales.filter((s) => inPeriod(s.date, period.range))
  const salesToday = sales.filter((s) => s.date === today)
  return [
    { title: 'Total Sales', icon: 'receipt', tone: 'teal', value: money(sum(salesInPeriod, (s) => s.total)), chip: `${plural(salesInPeriod.length, 'transaction', 'transactions')} · ${period.name}`, chipTone: 'positive' },
    { title: "Today's Sales", icon: 'sales', tone: 'cyan', value: money(sum(salesToday, (s) => s.total)), chip: `${plural(salesToday.length, 'transaction', 'transactions')} today` },
    { title: 'Quantity Sold', icon: 'stock', tone: 'warning', value: sum(salesInPeriod, (s) => s.qty).toLocaleString(), chip: `${plural(sum(salesToday, (s) => s.qty), 'unit', 'units')} today` }
  ]
}

// Stock cards show the shelf right now; Stock Added, Damaged and Expenses follow the chosen period
function inventoryOfficerCards({ inventory, purchases, incomingTransfers = [], damaged, expenses = [] }, { money, settings, period }) {
  const inStock = inventory.filter((i) => i.stock > 0)
  // Paid for this branch, or sent here by another branch, but not added with Add Medicine yet, so not in stock
  const waiting = [...purchases.filter((p) => p.status === 'Paid' && !p.receivedAt), ...incomingTransfers.filter((t) => t.status === 'Pending')]
  // Added to stock with Add Medicine during the period (the day it was added, in this computer's local time)
  const addedOn = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA') : null)
  const added = [...purchases, ...incomingTransfers].filter((x) => x.receivedAt && inPeriod(addedOn(x.receivedAt), period.range))
  const damagedInPeriod = damaged.filter((d) => inPeriod(d.date, period.range))
  const expensesInPeriod = expenses.filter((e) => inPeriod(e.date, period.range))
  return [
    { title: 'Waiting to Add', icon: 'procurement', tone: 'warning', value: waiting.length, chip: waiting.length ? `${plural(sum(waiting, (p) => p.qty), 'unit', 'units')} · use Add Medicine` : 'Nothing waiting', chipTone: waiting.length ? 'negative' : 'neutral' },
    { title: 'Products in Stock', icon: 'stock', tone: 'teal', value: inStock.length, chip: plural(sum(inStock, (i) => i.stock), 'unit on hand', 'units on hand') },
    { title: 'Low Stock', icon: 'low', tone: 'warning', value: inStock.filter((i) => i.status === 'Low Stock').length, chip: `Below ${settings.defaultMinStock} units`, chipTone: 'negative' },
    { title: 'Expiring Soon', icon: 'clock', tone: 'warning', value: inventory.filter((i) => i.inventoryStatus === 'Expiring Soon').length, chip: `Within ${settings.expiryWarningDays} days`, chipTone: 'negative' },
    { title: 'Expired', icon: 'expired', tone: 'danger', value: inStock.filter((i) => i.expired).length, chip: 'Must not be sold', chipTone: 'negative' },
    { title: 'Out of Stock', icon: 'empty', tone: 'danger', value: inventory.filter((i) => i.stock <= 0).length, chip: 'Ask for a restock', chipTone: 'negative' },
    { title: 'Stock Value', icon: 'money', tone: 'cyan', value: money(sum(inventory, (i) => i.stock * (i.purchasePrice || 0))), chip: `Selling value ${money(sum(inventory, (i) => i.stock * (i.sellingPrice || 0)))}`, chipTone: 'positive' },
    { title: 'Stock Added', icon: 'procurement', tone: 'teal', value: plural(sum(added, (x) => x.qty), 'unit', 'units'), chip: `${plural(added.length, 'arrival', 'arrivals')} · ${period.name}`, chipTone: 'positive' },
    { title: 'Damaged', icon: 'damaged', tone: 'danger', value: plural(sum(damagedInPeriod, (d) => d.qty), 'unit', 'units'), chip: `Loss ${money(sum(damagedInPeriod, (d) => d.lossValue))} · ${period.name}`, chipTone: 'negative' },
    { title: 'Expenses', icon: 'wallet', tone: 'warning', value: money(sum(expensesInPeriod, (e) => e.amount)), chip: `${plural(expensesInPeriod.length, 'expense', 'expenses')} · ${period.name}`, chipTone: 'negative' }
  ]
}

function procurementOfficerCards({ purchases }, { money, month }) {
  const pending = purchases.filter((p) => p.status === 'Pending')
  const paidThisMonth = purchases.filter((p) => p.status === 'Paid' && p.date.startsWith(month))
  return [
    { title: 'Awaiting Payment', icon: 'card', tone: 'warning', value: pending.length, chip: `${money(sum(pending, (p) => p.total))} to pay`, chipTone: 'negative' },
    { title: 'Paid This Month', icon: 'procurement', tone: 'teal', value: paidThisMonth.length, chip: `Total cost ${money(sum(paidThisMonth, (p) => p.total))}` }
  ]
}

// The Owner's dashboard is not built yet (the page shows Coming Soon)
const CARDS_BY_ROLE = {
  pharmacist: inventoryOfficerCards,
  cashier: cashierCards,
  purchase_officer: procurementOfficerCards
}

/** The cards for a role. `data` lists are already narrowed to the branch in scope; `period` is { range: [from, to], name }. */
export function dashboardCards(role, data, { money, settings, period }) {
  const today = todayKey()
  return (CARDS_BY_ROLE[role] || (() => []))(data, { money, settings, period, today, month: today.slice(0, 7) })
}

// Roles whose dashboard has a period picker
export const ROLES_WITH_PERIOD = ['cashier', 'pharmacist']

// The Inventory Officer's to-do list: stock rows to act on, most urgent first
const ATTENTION_ORDER = { Expired: 0, 'Out of Stock': 1, 'Expiring Soon': 2, 'Low Stock': 3 }
const ATTENTION_ACTION = {
  Expired: 'Take it off the shelf and record it as damaged',
  'Out of Stock': 'Ask the Procurement Officer for a restock',
  'Expiring Soon': 'Sell it first or move it to another branch',
  'Low Stock': 'Ask the Procurement Officer for a restock'
}

export const needsAttention = (inventory) =>
  inventory
    .filter((i) => i.inventoryStatus in ATTENTION_ORDER)
    .map((i) => ({ ...i, action: ATTENTION_ACTION[i.inventoryStatus] }))
    .sort((a, b) => ATTENTION_ORDER[a.inventoryStatus] - ATTENTION_ORDER[b.inventoryStatus] || (a.expiry || '').localeCompare(b.expiry || ''))
