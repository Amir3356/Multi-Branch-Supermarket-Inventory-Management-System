import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
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
import { ComingSoon, PageHeader, StatCard } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { selectTransfers } from '../features/transfers/store/transfersSlice'
import { selectDamaged } from '../features/damaged/store/damagedSlice'
import { selectExpenses } from '../features/expenses/store/expensesSlice'
import { loadExpenses } from '../features/expenses/store/expensesThunks'
import { dashboardCards } from '../features/dashboard/services/dashboardCards'
import { PERIODS, periodLabel, periodRange } from '../features/dashboard/services/periods'
import { expensesByCategory, lowestStock, spendingOverTime, stockStatusBreakdown } from '../features/dashboard/services/dashboardCharts'
import { BarChart, ChartCard, DonutChart, HorizontalBarChart } from '../features/dashboard/components/Charts'
import { todayKey } from '../utils'

const ROLE_INTRO = {
  pharmacist: 'Your branch’s stock at a glance.',
  cashier: 'Your branch’s sales today.',
  purchase_officer: 'Procurements and payments for every branch.'
}

const ICONS = { procurement: PackageCheck, stock: Package, low: AlertTriangle, clock: Clock, expired: XCircle, empty: Ban, money: DollarSign, damaged: PackageX, wallet: Wallet }

// Chart colour for each stock status
const STATUS_TONE = { 'In Stock': 'green', 'Low Stock': 'amber', 'Expiring Soon': 'orange', Expired: 'rose', 'Out of Stock': 'slate' }

// Each role's home page. The Inventory Officer's shows their branch's stock overview; the Owner's is Coming Soon.
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

  // The period for the Spending section: the Damaged and Expenses cards and the two spending charts
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
  const periodText = periodLabel(...range)
  // Chart axes and bars drop the cents on whole amounts
  const shortMoney = (v) => formatMoney(v).replace(/\.00$/, '')

  const renderCards = (group) => cards.filter((card) => card.group === group).map((card) => (
    <StatCard key={card.title} className={card.wide ? 'wide' : ''} title={card.title} icon={ICONS[card.icon] || Package} tone={card.tone} value={card.value} chip={card.chip} chipTone={card.chipTone} />
  ))

  return (
    <div className="content-section-card">
      {header}

      <section className="dashboard-section" aria-labelledby="dashboard-stock-title">
        <div className="section-header dashboard-section-header">
          <div>
            <h3 id="dashboard-stock-title">Stock right now</h3>
            <p className="page-desc">Live from Inventory. The period doesn’t change these.</p>
          </div>
        </div>
        <div className="dashboard-stock-grid">{renderCards('stock')}</div>
        <div className="charts-grid">
          <ChartCard title="Stock Status" subtitle="Batches by status">
            <DonutChart items={stockStatusBreakdown(inventory).map((s) => ({ ...s, tone: STATUS_TONE[s.label] }))} unit="batches" emptyText="No stock in this branch yet." />
          </ChartCard>
          <ChartCard title="Lowest Stock" subtitle={`Units on hand · low below ${settings.defaultMinStock}`}>
            <HorizontalBarChart
              items={lowestStock(inventory).map((p) => ({ ...p, tone: p.value <= 0 ? 'rose' : p.value < settings.defaultMinStock ? 'amber' : 'green' }))}
              format={(v) => `${v.toLocaleString()} units`}
              emptyText="No stock in this branch yet."
            />
          </ChartCard>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-spending-title">
        <div className="section-header dashboard-section-header">
          <div>
            <h3 id="dashboard-spending-title">Spending</h3>
            <p className="page-desc">{customInvalid ? 'Choose a valid date range.' : periodText}</p>
          </div>
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
                  <input id="dashboard-from" type="date" max={custom.to || undefined} className={`input-field ${customInvalid ? 'error' : ''}`} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-invalid={customInvalid} aria-describedby={customInvalid ? 'dashboard-range-error' : undefined} />
                </div>
                <div className="form-group">
                  <label htmlFor="dashboard-to">To</label>
                  <input id="dashboard-to" type="date" min={custom.from || undefined} className={`input-field ${customInvalid ? 'error' : ''}`} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-invalid={customInvalid} aria-describedby={customInvalid ? 'dashboard-range-error' : undefined} />
                </div>
              </>
            )}
          </div>
        </div>
        {customInvalid ? (
          <p id="dashboard-range-error" className="error-msg dashboard-range-error" role="alert">Choose a start date on or before the end date.</p>
        ) : (
          <>
            <div className="dashboard-period-grid">{renderCards('period')}</div>
            <div className="charts-grid">
              <ChartCard title="Expenses and Damage Loss" subtitle={periodName}>
                <BarChart
                  columns={spendingOverTime({ expenses, damaged }, range)}
                  series={[{ label: 'Expenses', tone: 'cyan' }, { label: 'Damage Loss', tone: 'rose' }]}
                  format={shortMoney}
                  emptyText="No expenses or damage in this period."
                />
              </ChartCard>
              <ChartCard title="Expenses by Category" subtitle={periodName}>
                <HorizontalBarChart items={expensesByCategory(expenses, range)} format={shortMoney} emptyText="No expenses in this period." />
              </ChartCard>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
