import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  Clock,
  DollarSign,
  Package,
  PackageCheck,
  PackageX,
  Wallet,
  XCircle
} from 'lucide-react'
import { BranchTag, ComingSoon, EmptyRow, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { PATHS } from '../routes/paths'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { selectTransfers } from '../features/transfers/store/transfersSlice'
import { selectDamaged } from '../features/damaged/store/damagedSlice'
import { selectExpenses } from '../features/expenses/store/expensesSlice'
import { loadExpenses } from '../features/expenses/store/expensesThunks'
import { dashboardCards, needsAttention } from '../features/dashboard/services/dashboardCards'
import { PERIODS, periodLabel, periodRange } from '../features/dashboard/services/periods'
import { todayKey } from '../utils'

const ROLE_INTRO = {
  pharmacist: 'Your branch’s stock at a glance: what to add, what needs restocking, and what is expiring.',
  cashier: 'Your branch’s sales today.',
  purchase_officer: 'Procurements and payments for every branch.'
}

const ICONS = { procurement: PackageCheck, stock: Package, low: AlertTriangle, clock: Clock, expired: XCircle, empty: Ban, money: DollarSign, damaged: PackageX, wallet: Wallet }

// How many rows the Needs Attention list shows before pointing to Inventory
const ATTENTION_LIMIT = 8

// Each role's home page. The Inventory Officer's shows their branch's stock and what to act on; the Owner's is Coming Soon.
export default function DashboardPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const user = useSelector(selectCurrentUser)
  const settings = useSelector(selectSettings)
  const { scopeLabel, branchById } = useBranchScope()
  const role = user?.role
  const staffBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null
  const isInventoryOfficer = role === 'pharmacist'
  const atBranch = (branchId) => branchId === staffBranchId

  const inventory = useSelector(selectInventory).filter((i) => atBranch(i.branchId))
  const purchases = useSelector(selectPurchases).filter((p) => atBranch(p.branchId))
  const incomingTransfers = useSelector(selectTransfers).filter((t) => atBranch(t.to))
  const damaged = useSelector(selectDamaged).filter((d) => atBranch(d.branchId))
  const expenses = useSelector(selectExpenses).filter((e) => atBranch(e.branchId))

  // The period for the cards that cover a stretch of time (Stock Added, Damaged, Expenses)
  const [period, setPeriod] = useState('monthly')
  const [custom, setCustom] = useState(() => ({ from: `${todayKey().slice(0, 7)}-01`, to: todayKey() }))
  const customInvalid = period === 'custom' && (!custom.from || !custom.to || custom.from > custom.to)
  const range = periodRange(period, custom.from, custom.to)
  const periodName = period === 'custom' ? periodLabel(...range) : PERIODS[period]

  // Expenses are only loaded by their own page otherwise
  useEffect(() => {
    if (isInventoryOfficer) dispatch(loadExpenses()).catch(() => {})
  }, [isInventoryOfficer, dispatch])

  if (role === 'owner') {
    return <ComingSoon feature="Owner Dashboard" description="An overview of every branch (staff, sales, stock and procurement) will appear here." />
  }

  const header = <PageHeader title={`Dashboard · ${staffBranchId ? branchById(staffBranchId)?.name || '' : scopeLabel}`} description={ROLE_INTRO[role]} />
  if (!isInventoryOfficer) return <div className="content-section-card">{header}</div>

  const cards = dashboardCards('pharmacist', { inventory, purchases, incomingTransfers, damaged, expenses }, { money: formatMoney, settings, period: { range, name: periodName } })
  const attention = needsAttention(inventory)
  // Arrived here but not in stock yet: paid orders and transfers from other branches, added with Add Medicine
  const waiting = [
    ...purchases.filter((p) => p.status === 'Paid' && !p.receivedAt).map((p) => ({ key: p.id, product: p.product, qty: p.qty, from: `Procurement ${p.id} · ${p.supplier}`, date: p.date })),
    ...incomingTransfers.filter((t) => t.status === 'Pending').map((t) => ({ key: t.id, product: t.product, qty: t.qty, from: `Transfer ${t.id} · from ${branchById(t.from)?.name || t.from}`, date: t.date }))
  ]

  return (
    <div className="content-section-card">
      {header}

      <div className="dashboard-period">
        <div className="form-group">
          <label htmlFor="dashboard-period">Period</label>
          <select id="dashboard-period" className="input-field" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {Object.entries(PERIODS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {period === 'custom' && (
          <>
            <div className="form-group">
              <label htmlFor="dashboard-from">From</label>
              <input id="dashboard-from" type="date" max={custom.to || undefined} className={`input-field ${customInvalid ? 'error' : ''}`} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="dashboard-to">To</label>
              <input id="dashboard-to" type="date" min={custom.from || undefined} className={`input-field ${customInvalid ? 'error' : ''}`} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          </>
        )}
        <span className={customInvalid ? 'error-msg' : 'field-hint'}>
          {customInvalid ? 'Choose a start date on or before the end date.' : `Stock Added, Damaged and Expenses cover ${periodLabel(...range)}; the other cards show the stock right now.`}
        </span>
      </div>

      <div className="stats-grid" style={{ marginTop: '1.5rem' }}>
        {!customInvalid && cards.map((card) => (
          <StatCard key={card.title} title={card.title} icon={ICONS[card.icon] || Package} tone={card.tone} value={card.value} chip={card.chip} chipTone={card.chipTone} />
        ))}
      </div>

      <div className="section-header" style={{ marginTop: '2.5rem' }}>
        <div>
          <h3>Needs Attention</h3>
          <p className="page-desc">Stock to act on, most urgent first.</p>
        </div>
        <Link className="secondary-action-btn" to={PATHS.inventory}>Open Inventory</Link>
      </div>
      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Batch Number</th>
              <th>Current Stock</th>
              <th>Expiration Date</th>
              <th>Status</th>
              <th>What to Do</th>
            </tr>
          </thead>
          <tbody>
            {attention.slice(0, ATTENTION_LIMIT).map((i) => (
              <tr key={i.key}>
                <td className="fw-600">{i.name}</td>
                <td><span className="batch-badge">{i.batch}</span></td>
                <td>{i.stock} units</td>
                <td className="nowrap">{i.expiry}</td>
                <td><StatusTag status={i.inventoryStatus} /></td>
                <td>{i.action}</td>
              </tr>
            ))}
            {attention.length === 0 && <EmptyRow colSpan={6}>Nothing needs attention: stock levels and expiry dates are fine.</EmptyRow>}
          </tbody>
        </table>
      </div>
      {attention.length > ATTENTION_LIMIT && (
        <p className="page-desc" style={{ marginTop: '0.5rem' }}>{attention.length - ATTENTION_LIMIT} more in Inventory.</p>
      )}

      <div className="section-header" style={{ marginTop: '2.5rem' }}>
        <div>
          <h3>Waiting to Add</h3>
          <p className="page-desc">Stock that arrived for this branch but isn’t in Inventory yet. Add it with Add Medicine.</p>
        </div>
        {waiting.length > 0 && <Link className="primary-action-btn" to={PATHS.inventory}>Go to Add Medicine</Link>}
      </div>
      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>From</th>
              <th>Date</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((w) => (
              <tr key={w.key}>
                <td className="fw-600">{w.product}</td>
                <td>{w.qty} units</td>
                <td>{w.from}</td>
                <td className="nowrap">{w.date}</td>
                <td><BranchTag branch={branchById(staffBranchId)} /></td>
              </tr>
            ))}
            {waiting.length === 0 && <EmptyRow colSpan={5}>Nothing waiting: every arrival has been added.</EmptyRow>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
