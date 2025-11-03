import { todayKey } from '../../../utils'
import { isExtraQuantity } from '../../supplierReturns/model/returnRequest'
import { inPeriod } from './periods'

// Each role's dashboard: summary cards worked out from the app's own data (no mock data), for the branch in scope.
// Cards are { title, icon, tone, value, chip, chipTone }; `icon` is a key the page maps to an icon.

const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0)
const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`

// Credit a supplier still owes on approved returns: units not yet replaced × the batch's unit cost
const creditOwedOn = (requests, purchases) =>
  sum(
    requests.filter((r) => (r.status === 'Approved' || r.status === 'Partially Replaced') && !isExtraQuantity(r)),
    (r) => {
      const purchase = purchases.find((p) => p.id === r.procurementId)
      return purchase ? (r.qty - (r.replacedQty || 0)) * (purchase.total / purchase.qty) : 0
    }
  )

// Total Sales, Quantity Sold and Customer Returns follow the chosen period; Today's Sales is always today
function cashierCards({ sales, customerReturns }, { money, today, period }) {
  const salesInPeriod = sales.filter((s) => inPeriod(s.date, period.range))
  const salesToday = sales.filter((s) => s.date === today)
  const returnsInPeriod = customerReturns.filter((r) => inPeriod(r.date, period.range))
  return [
    { title: 'Total Sales', icon: 'receipt', tone: 'teal', value: money(sum(salesInPeriod, (s) => s.total)), chip: `${plural(salesInPeriod.length, 'transaction', 'transactions')} · ${period.name}`, chipTone: 'positive' },
    { title: "Today's Sales", icon: 'sales', tone: 'cyan', value: money(sum(salesToday, (s) => s.total)), chip: `${plural(salesToday.length, 'transaction', 'transactions')} today` },
    { title: 'Quantity Sold', icon: 'stock', tone: 'warning', value: sum(salesInPeriod, (s) => s.qty).toLocaleString(), chip: `${plural(sum(salesToday, (s) => s.qty), 'unit', 'units')} today` },
    { title: 'Customer Returns', icon: 'returns', tone: 'warning', value: returnsInPeriod.length, chip: `Refunded ${money(sum(returnsInPeriod, (r) => r.refund))}`, chipTone: 'negative' }
  ]
}

function inventoryOfficerCards({ inventory, purchases, incomingTransfers = [], returnRequests, damaged }, { money, month, settings }) {
  const inStock = inventory.filter((i) => i.stock > 0)
  // Paid for this branch, or sent here by another branch, but not added with Add Medicine yet, so not in stock
  const waiting = [...purchases.filter((p) => p.status === 'Paid' && !p.receivedAt), ...incomingTransfers.filter((t) => t.status === 'Pending')]
  const damagedThisMonth = damaged.filter((d) => d.date.startsWith(month))
  return [
    { title: 'Waiting to Add', icon: 'procurement', tone: 'warning', value: waiting.length, chip: waiting.length ? `${plural(sum(waiting, (p) => p.qty), 'unit', 'units')} · use Add Medicine` : 'Nothing waiting', chipTone: waiting.length ? 'negative' : 'neutral' },
    { title: 'Products in Stock', icon: 'stock', tone: 'teal', value: inStock.length, chip: plural(sum(inStock, (i) => i.stock), 'unit on hand', 'units on hand') },
    { title: 'Low Stock', icon: 'low', tone: 'warning', value: inStock.filter((i) => i.status === 'Low Stock').length, chip: `Below ${settings.defaultMinStock} units`, chipTone: 'negative' },
    { title: 'Expiring Soon', icon: 'clock', tone: 'warning', value: inventory.filter((i) => i.inventoryStatus === 'Expiring Soon').length, chip: `Within ${settings.expiryWarningDays} days`, chipTone: 'negative' },
    { title: 'Expired', icon: 'expired', tone: 'danger', value: inStock.filter((i) => i.expired).length, chip: 'Must not be sold', chipTone: 'negative' },
    { title: 'Out of Stock', icon: 'empty', tone: 'danger', value: inventory.filter((i) => i.stock <= 0).length, chip: 'Ask for a restock', chipTone: 'negative' },
    { title: 'Stock Value', icon: 'money', tone: 'cyan', value: money(sum(inventory, (i) => i.stock * (i.purchasePrice || 0))), chip: `Selling value ${money(sum(inventory, (i) => i.stock * (i.sellingPrice || 0)))}`, chipTone: 'positive' },
    { title: 'Return Requests Pending', icon: 'returns', tone: 'warning', value: returnRequests.filter((r) => r.status === 'Pending').length, chip: 'Waiting for the Procurement Officer' },
    { title: 'Damaged This Month', icon: 'damaged', tone: 'danger', value: plural(sum(damagedThisMonth, (d) => d.qty), 'unit', 'units'), chip: `Loss ${money(sum(damagedThisMonth, (d) => d.lossValue))}`, chipTone: 'negative' }
  ]
}

function procurementOfficerCards({ purchases, returnRequests }, { money, month }) {
  const pending = purchases.filter((p) => p.status === 'Pending')
  const paidThisMonth = purchases.filter((p) => p.status === 'Paid' && p.date.startsWith(month))
  const awaitingReplacement = returnRequests.filter((r) => r.status === 'Approved' && !isExtraQuantity(r))
  return [
    { title: 'Awaiting Payment', icon: 'card', tone: 'warning', value: pending.length, chip: `${money(sum(pending, (p) => p.total))} to pay`, chipTone: 'negative' },
    { title: 'Paid This Month', icon: 'procurement', tone: 'teal', value: paidThisMonth.length, chip: `Total cost ${money(sum(paidThisMonth, (p) => p.total))}` },
    { title: 'Return Requests to Review', icon: 'returns', tone: 'warning', value: returnRequests.filter((r) => r.status === 'Pending').length, chip: 'Approve or reject', chipTone: 'negative' },
    { title: 'Awaiting Replacement', icon: 'stock', tone: 'cyan', value: awaitingReplacement.length, chip: plural(sum(awaitingReplacement, (r) => r.qty), 'unit returned', 'units returned') },
    { title: 'Supplier Credit Owed', icon: 'money', tone: 'teal', value: money(creditOwedOn(returnRequests, purchases)), chip: 'On approved returns', chipTone: 'positive' }
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
export const ROLES_WITH_PERIOD = ['cashier']
