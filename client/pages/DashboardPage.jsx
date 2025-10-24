import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  PackageCheck,
  PackageX,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { StatCard, StatusTag } from '../components'
import { useFormatMoney, useTheme } from '../hooks'
import { DATE_PRESETS, currencySymbol, formatRangeLabel, getPresetRange, todayKey } from '../utils'
import { PATHS } from '../routes/paths'
import { selectBranches } from '../features/branches/store/branchesSlice'
import { selectSettings } from '../features/policy/store/settingsSlice'
import { selectCategories } from '../features/inventory/store/productsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectCategoryRows, selectPerformanceRows } from '../features/dashboard/store/selectors'
import DashboardCharts from '../features/dashboard/components/DashboardCharts'
import './DashboardPage.css'

export default function DashboardPage() {
  const formatMoney = useFormatMoney()
  const { theme } = useTheme()
  const branches = useSelector(selectBranches)
  const settings = useSelector(selectSettings)
  const categories = useSelector(selectCategories)
  const inventory = useSelector(selectInventory)
  const performanceRows = useSelector(selectPerformanceRows)
  const categoryRows = useSelector(selectCategoryRows)

  // The Dashboard has its own filters: a branch (or all) and a period
  const [dashboardBranch, setDashboardBranch] = useState('all')
  const [dateFilter, setDateFilter] = useState({ preset: 'month', from: '', to: '' })

  const branchById = (id) => branches.find((b) => b.id === id)
  const isDashboardAll = dashboardBranch === 'all' || !branchById(dashboardBranch)
  const branchInfo = isDashboardAll ? null : branchById(dashboardBranch)
  const scopeLabel = isDashboardAll ? 'All Branches' : branchInfo.name
  const inDashboard = (branchId) => isDashboardAll || branchId === dashboardBranch
  const activeBranchCount = branches.filter((b) => b.status === 'Active').length

  // Stock on hand now
  const scopedInventory = inventory.filter((i) => inDashboard(i.branchId))
  const inStockRows = scopedInventory.filter((i) => i.stock > 0)
  const stockUnits = inStockRows.reduce((sum, i) => sum + i.stock, 0)
  const productCount = new Set(inStockRows.map((i) => i.medId)).size
  const lowStock = scopedInventory.filter((i) => i.status === 'Low Stock').length
  const outOfStock = scopedInventory.filter((i) => i.status === 'Out of Stock').length
  const expiringSoon = scopedInventory.filter((i) => i.expiringSoon && i.stock > 0).length

  // Overall (all time) figures from the branch records
  const totalRevenue = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + (b.revenue || 0), 0)
  const totalExpenses = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + (b.expenses || 0), 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0

  // Period filter
  const today = todayKey()
  const isCustomRange = dateFilter.preset === 'custom'
  const [rangeFrom, rangeTo] = isCustomRange ? [dateFilter.from, dateFilter.to] : getPresetRange(dateFilter.preset)
  const rangeInvalid = isCustomRange && (!rangeFrom || !rangeTo || rangeFrom > rangeTo)
  const inRange = (date) => !rangeInvalid && date >= rangeFrom && date <= rangeTo
  const rangeLabel = rangeInvalid ? 'Choose a valid date range' : `${DATE_PRESETS[dateFilter.preset]} · ${formatRangeLabel(rangeFrom, rangeTo)}`
  const rangeRows = performanceRows.filter((r) => inRange(r.date))
  const rangeCategoryRows = categoryRows.filter((r) => inRange(r.date))

  const changeDatePreset = (preset) => {
    // Custom starts from the range currently shown, so the pharmacist only adjusts it
    if (preset === 'custom') setDateFilter({ preset, from: rangeFrom || today, to: rangeTo || today })
    else setDateFilter((prev) => ({ ...prev, preset }))
  }

  // Figures for the selected branch and period
  const periodRows = rangeRows.filter((r) => inDashboard(r.branchId))
  const periodSum = (field) => periodRows.reduce((sum, r) => sum + r[field], 0)
  const periodTransactions = periodSum('transactions')
  const periodUnitsSold = periodSum('unitsSold')
  const periodRevenue = periodSum('revenue')
  const periodPurchases = periodSum('purchases')
  const periodExpenses = periodSum('expenses')
  const periodProfit = periodRevenue - periodSum('costOfGoods') - periodExpenses

  const branchPeriod = (branchId) => {
    const rows = rangeRows.filter((r) => r.branchId === branchId)
    const revenue = rows.reduce((sum, r) => sum + r.revenue, 0)
    const expenses = rows.reduce((sum, r) => sum + r.costOfGoods + r.expenses, 0)
    return { revenue, expenses, profit: revenue - expenses }
  }
  const branchSummary = (branchId) => {
    const items = inventory.filter((i) => i.branchId === branchId)
    return { units: items.reduce((sum, i) => sum + i.stock, 0), alerts: items.filter((i) => i.status !== 'In Stock' || i.expiringSoon).length }
  }

  return (
    <>
      {/* Filters: period and branch scope every figure and chart below */}
      <p className="dashboard-filter-hint">Select a branch to view its dashboard, or choose All Branches to see the whole network.</p>
      <div className="dashboard-filter-row">
        <label className="dashboard-filter">
          <Clock size={16} />
          <span>Period</span>
          <select className="input-field" value={dateFilter.preset} onChange={(e) => changeDatePreset(e.target.value)} aria-label="Dashboard date filter">
            {Object.entries(DATE_PRESETS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>

        {isCustomRange && (
          <div className="dashboard-filter date-range">
            <label>
              <span>From</span>
              <input type="date" className={`input-field ${rangeInvalid ? 'error' : ''}`} value={dateFilter.from} max={today} onChange={(e) => setDateFilter((prev) => ({ ...prev, from: e.target.value }))} aria-label="Custom range start" />
            </label>
            <label>
              <span>To</span>
              <input type="date" className={`input-field ${rangeInvalid ? 'error' : ''}`} value={dateFilter.to} max={today} onChange={(e) => setDateFilter((prev) => ({ ...prev, to: e.target.value }))} aria-label="Custom range end" />
            </label>
          </div>
        )}

        <label className="dashboard-filter">
          <Building2 size={16} />
          <span>Branch</span>
          <select className="input-field" value={isDashboardAll ? 'all' : dashboardBranch} onChange={(e) => setDashboardBranch(e.target.value)} aria-label="Dashboard branch filter">
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </div>
      {rangeInvalid && <p className="error-msg" style={{ marginTop: '-0.6rem', marginBottom: '1rem' }}>The From date must be on or before the To date.</p>}

      {/* Period figures */}
      <div className="section-label">
        <Clock size={14} /> {rangeLabel} · {scopeLabel}
      </div>
      <div className="stats-grid today-grid">
        <StatCard title="Sales" icon={ShoppingCart} tone="cyan" value={periodTransactions.toLocaleString()} chip={`${periodTransactions === 1 ? 'transaction' : 'transactions'} · ${periodUnitsSold.toLocaleString()} units sold`} />
        <StatCard title="Purchases" icon={PackageCheck} tone="teal" value={formatMoney(periodPurchases)} chip="Stock bought from suppliers" />
        <StatCard title="Expenses" icon={Wallet} tone="danger" value={formatMoney(periodExpenses)} chip="Operating costs" chipTone="negative" />
        <StatCard title="Revenue" icon={Receipt} tone="cyan" value={formatMoney(periodRevenue)} chipTone="positive" chip={<><TrendingUp size={12} /> From {periodTransactions.toLocaleString()} {periodTransactions === 1 ? 'sale' : 'sales'}</>} />
        <StatCard
          title="Profit"
          icon={DollarSign}
          tone={periodProfit < 0 ? 'danger' : 'teal'}
          value={formatMoney(periodProfit)}
          valueStyle={{ color: periodProfit < 0 ? '#fb7185' : '#34d399' }}
          chip="Revenue − cost of goods − expenses"
          chipTone={periodProfit < 0 ? 'negative' : 'positive'}
          chipTitle="Revenue − cost of goods sold − expenses"
        />
      </div>

      {/* Overall (all time) */}
      <div className="section-label" style={{ marginTop: '1.75rem' }}>
        <BarChart3 size={14} /> Overall (all time) · {scopeLabel}
      </div>
      <div className="stats-grid today-grid">
        <StatCard
          title="Total Branches"
          icon={Building2}
          tone="cyan"
          value={branches.length}
          chipTone="positive"
          chip={<><CheckCircle2 size={12} /> {activeBranchCount} active{branches.length - activeBranchCount ? ` · ${branches.length - activeBranchCount} inactive` : ''}</>}
        />
        <StatCard title="Total Revenue" icon={Receipt} tone="cyan" value={formatMoney(totalRevenue)} chipTone="positive" chip={<><TrendingUp size={12} /> {scopeLabel}</>} />
        <StatCard title="Total Expenses" icon={Wallet} tone="danger" value={formatMoney(totalExpenses)} chip="Stock Intake & Operations" chipTone="negative" />
        <StatCard title="Total Profit" icon={DollarSign} tone="teal" value={formatMoney(netProfit)} valueStyle={{ color: '#34d399' }} chipTone="positive" chip={<><TrendingUp size={12} /> {profitMargin.toFixed(1)}% Profit Margin</>} />
      </div>

      {/* Stock on hand now */}
      <div className="section-label" style={{ marginTop: '1.75rem' }}>
        <Package size={14} /> Stock on hand now · {scopeLabel}
      </div>
      <div className="stats-grid">
        <StatCard title="Total Stock" icon={Package} tone="cyan" value={stockUnits.toLocaleString()} chip={`units · ${productCount} ${productCount === 1 ? 'product' : 'products'}`} />
        <StatCard title="Low Stock" icon={AlertTriangle} tone="warning" value={lowStock} chip={`${lowStock === 1 ? 'item' : 'items'} below the low stock level`} chipTone="negative" />
        <StatCard title="Out of Stock" icon={PackageX} tone="danger" value={outOfStock} valueStyle={{ color: outOfStock ? '#fb7185' : undefined }} chip={`${outOfStock === 1 ? 'item needs' : 'items need'} restocking`} chipTone="negative" />
        <StatCard title="Expiring Soon" icon={Clock} tone="warning" value={expiringSoon} valueStyle={{ color: expiringSoon ? '#f59e0b' : undefined }} chip={`${expiringSoon === 1 ? 'batch expires' : 'batches expire'} within ${settings.expiryWarningDays} days`} chipTone="negative" />
      </div>

      {/* Charts */}
      <div className="section-label" style={{ marginTop: '1.75rem' }}>
        <TrendingUp size={14} /> Trends · {rangeLabel} · {scopeLabel}
      </div>
      <DashboardCharts
        theme={theme}
        branchId={isDashboardAll ? 'all' : dashboardBranch}
        branches={branches}
        rows={rangeRows}
        categoryRows={rangeCategoryRows}
        categories={categories}
        formatMoney={formatMoney}
        currencySymbol={currencySymbol(settings.currency)}
      />

      {/* Branch Performance (network view only) */}
      {isDashboardAll && (
        <div className="content-section-card" style={{ marginTop: '1.5rem' }}>
          <div className="section-header">
            <div>
              <h3>Branch Performance</h3>
              <p className="page-desc">{rangeLabel}</p>
            </div>
            <Link className="link-btn" to={PATHS.branches}>
              Manage Branches <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Total Profit</th>
                  <th>Units in Stock</th>
                  <th>Stock Alerts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const summary = branchSummary(b.id)
                  const period = branchPeriod(b.id)
                  return (
                    <tr key={b.id}>
                      <td className="fw-600">{b.name}</td>
                      <td>{formatMoney(period.revenue)}</td>
                      <td>{formatMoney(period.expenses)}</td>
                      <td className="fw-600" style={{ color: period.profit < 0 ? '#fb7185' : '#34d399' }}>{formatMoney(period.profit)}</td>
                      <td>{summary.units.toLocaleString()} units</td>
                      <td>
                        <StatusTag status={summary.alerts ? 'Low Stock' : 'In Stock'} />
                        {summary.alerts ? <span style={{ marginLeft: '0.4rem' }}>{summary.alerts}</span> : null}
                      </td>
                      <td>
                        <button className="link-btn" onClick={() => setDashboardBranch(b.id)}>
                          Open <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
