import { useState } from 'react'
import { useSelector } from 'react-redux'
import { AlertTriangle, ArrowDownUp, Banknote, Boxes, CalendarClock, CircleDollarSign, Clock, FileText, Hourglass, Package, PackageCheck, ShoppingCart, TrendingUp, Truck, Wallet } from 'lucide-react'
import { PageHeader, StatCard } from '../../../components'
import { useBranchScope, useFormatMoney } from '../../../hooks'
import { selectSettings } from '../../policy/store/settingsSlice'
import { BarChart, ChartCard, DonutChart, HorizontalBarChart, PieChart } from '../../dashboard/components/Charts'
import { PeriodError, PeriodPicker } from '../../dashboard/components/DashboardParts'
import { useReport } from '../hooks/useReport'
import { exportReportPdf } from '../services/reportPdf'
import './ReportPage.css'

const CARD_ICONS = { revenue: CircleDollarSign, units: Boxes, cost: Wallet, profit: TrendingUp, net: Banknote, value: Package, low: AlertTriangle, expiry: CalendarClock, orders: ShoppingCart, pending: Hourglass, delivery: Truck, received: PackageCheck, movement: ArrowDownUp, time: Clock }

// One chart from a spec, drawn with the dashboard's charts
function SpecChart({ chart, money }) {
  const format = chart.money ? money : (v) => Number(v).toLocaleString('en-US')
  if (chart.kind === 'pie') return <PieChart items={chart.items} format={format} emptyText={chart.empty} />
  if (chart.kind === 'donut') return <DonutChart items={chart.items} unit={chart.unit} emptyText={chart.empty} />
  if (chart.kind === 'hbar') return <HorizontalBarChart items={chart.items} format={format} emptyText={chart.empty} />
  return <BarChart columns={chart.columns} series={chart.series} format={format} wholeNumbers={chart.wholeNumbers} wrapLabels={chart.columns.length < 8} emptyText={chart.empty} />
}

function SpecTable({ table }) {
  return (
    <section className="report-table-section">
      <div className="report-table-heading">
        <h3>{table.title}</h3>
        {table.note && <span className="page-desc">{table.note}</span>}
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>{table.columns.map((c) => <th key={c.label} className={c.align === 'right' ? 'num' : undefined}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={table.strongRows?.includes(i) ? 'report-strong-row' : undefined}>
                {row.map((cell, j) => <td key={j} className={table.columns[j].align === 'right' ? 'num nowrap' : undefined}>{cell}</td>)}
              </tr>
            ))}
            {table.rows.length === 0 && (
              <tr><td colSpan={table.columns.length} className="report-empty">{table.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {table.footnote && <p className="page-desc report-footnote">{table.footnote}</p>}
    </section>
  )
}

/**
 * A report page: period and branch filters, then the report's cards, charts and tables, with Export PDF. `kind` picks
 * the server report; `buildSpec(data, money)` turns its figures into what's shown (the PDF draws the same spec).
 */
export default function ReportPage({ kind, title, description, buildSpec }) {
  const { period, branchId, setBranchId, data, error, loading } = useReport(kind)
  const { branches, branchById } = useBranchScope()
  const money = useFormatMoney()
  const { pharmacyName } = useSelector(selectSettings)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const spec = data ? buildSpec(data, money) : null
  const scope = branchId === 'all' ? 'All Branches' : branchById(branchId)?.name || branchId

  const exportPdf = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportReportPdf({ title, spec, pharmacyName, periodText: period.text, scope, kind, from: data.from, to: data.to })
    } catch (e) {
      setExportError(`The PDF couldn't be created: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="content-section-card report-page">
      <PageHeader title={title} description={description}>
        <button type="button" className="secondary-action-btn" onClick={exportPdf} disabled={!spec || exporting || loading}>
          <FileText size={16} /> {exporting ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </PageHeader>

      <div className="report-filters">
        <PeriodPicker state={period} errorId={`${kind}-range-error`} />
        {/* Styled like the period picker beside it */}
        <div className="dashboard-period">
          <div className="form-group">
            <label htmlFor={`${kind}-branch`}>Branch</label>
            <select id={`${kind}-branch`} className="input-field" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="all">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      {!period.invalid && <p className="page-desc report-scope">{period.text} · {scope}{spec?.note ? ` · ${spec.note}` : ''}</p>}

      {period.invalid && <PeriodError id={`${kind}-range-error`} />}
      {exportError && <p className="error-msg">{exportError}</p>}
      {error && <p className="error-msg">{error}</p>}
      {loading && !spec && <p className="page-desc report-loading">Loading the report…</p>}

      {spec && !period.invalid && (
        <div className={loading ? 'report-body is-loading' : 'report-body'} aria-busy={loading}>
          <div className="stats-grid report-cards">
            {spec.cards.map((c) => (
              <StatCard key={c.title} title={c.title} icon={CARD_ICONS[c.icon] || Package} tone={c.tone} value={c.value} chip={c.chip} chipTone={c.chipTone} />
            ))}
          </div>

          <div className="charts-grid">
            {spec.charts.map((chart) => (
              <ChartCard key={chart.title} title={chart.title} subtitle={chart.subtitle}>
                <SpecChart chart={chart} money={money} />
              </ChartCard>
            ))}
          </div>

          {spec.tables.map((table) => <SpecTable key={table.title} table={table} />)}
        </div>
      )}
    </div>
  )
}
