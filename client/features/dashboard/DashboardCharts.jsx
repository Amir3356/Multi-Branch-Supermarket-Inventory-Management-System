import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts'
import {
  Clock
} from 'lucide-react'
import { shortDate, compactNumber, CHART_THEMES, niceTicks } from '../../utils'
import { ChartCard, ChartTooltip } from '../../components'

export default function DashboardCharts({ branchId, branches, rows, categoryRows, categories, formatMoney, currencySymbol, theme }) {
  const CHART_COLORS = CHART_THEMES[theme] || CHART_THEMES.dark
  const axisProps = {
    stroke: CHART_COLORS.grid,
    tick: { fill: CHART_COLORS.axis, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: CHART_COLORS.grid }
  }
  const inBranch = (id) => branchId === 'all' || id === branchId
  const money = (v) => formatMoney(v)
  const axisMoney = (v) => `${v < 0 ? '-' : ''}${currencySymbol}${compactNumber(Math.abs(v))}`

  // Daily totals for the selected branch (or the whole network) within the date filter
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const daily = dates.map((date) => {
    const dayRows = rows.filter((r) => r.date === date && inBranch(r.branchId))
    const sum = (field) => Math.round(dayRows.reduce((s, r) => s + r[field], 0) * 100) / 100
    const revenue = sum('revenue')
    const expenses = sum('expenses')
    return {
      date,
      transactions: sum('transactions'),
      revenue,
      expenses,
      purchases: sum('purchases'),
      profit: Math.round((revenue - sum('costOfGoods') - expenses) * 100) / 100
    }
  })
  const hasTrend = daily.length >= 2
  const rangeLabel = dates.length ? `Daily · ${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : 'No data in this period'

  // Revenue per branch over the period; the selected branch is emphasised, the rest go gray
  const byBranch = branches
    .map((b) => ({
      id: b.id,
      name: b.name.replace(' Branch', '').replace(' (HQ)', ' HQ'),
      fullName: b.name,
      revenue: Math.round(rows.filter((r) => r.branchId === b.id).reduce((s, r) => s + r.revenue, 0) * 100) / 100
    }))
    .filter((b) => b.revenue > 0)

  // Units sold per category for the selected scope and period, highest first
  const byCategory = categories
    .map((category) => {
      const catRows = categoryRows.filter((r) => r.category === category && inBranch(r.branchId))
      return {
        category,
        unitsSold: catRows.reduce((s, r) => s + r.unitsSold, 0),
        revenue: Math.round(catRows.reduce((s, r) => s + r.revenue, 0) * 100) / 100
      }
    })
    .filter((c) => c.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)

  // A trend needs at least two days; a single day (e.g. Today) shows a short note instead
  const trendOrNote = (chart) =>
    hasTrend ? chart : (
      <div className="chart-empty">
        <Clock size={20} />
        <span>{daily.length ? 'Only one day in this period. Choose a longer period to see a trend.' : 'No data in this period.'}</span>
      </div>
    )

  const ticksFor = (...fields) => {
    const ticks = niceTicks(daily.flatMap((d) => fields.map((f) => d[f])))
    return { ticks, domain: [ticks[0], ticks[ticks.length - 1]], interval: 0 }
  }
  const branchTicks = niceTicks(byBranch.map((b) => b.revenue))
  const categoryTicks = niceTicks(byCategory.map((c) => c.unitsSold))
  const emptyBar = (items) => !items.length && (
    <div className="chart-empty">
      <Clock size={20} />
      <span>No sales in this period.</span>
    </div>
  )

  const timeTable = (field, label, format) => ({
    columns: ['Date', label],
    rows: daily.map((d) => [shortDate(d.date), format(d[field])])
  })

  const tooltip = (formatValue) => (
    <Tooltip
      cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
      content={<ChartTooltip formatValue={formatValue} labelFormatter={shortDate} />}
    />
  )

  const activeDot = (color) => ({ r: 4, fill: color, stroke: CHART_COLORS.surface, strokeWidth: 2 })

  return (
    <div className="chart-grid">
      <ChartCard title="Sales Over Time" subtitle={`Sale transactions · ${rangeLabel}`} table={timeTable('transactions', 'Transactions', (v) => v.toLocaleString())}>
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={compactNumber} width={48} {...axisProps} axisLine={false} {...ticksFor('transactions')} />
            {tooltip((v) => `${v.toLocaleString()} transactions`)}
            <Area type="monotone" dataKey="transactions" name="Sales" stroke={CHART_COLORS.series1} strokeWidth={2} fill={CHART_COLORS.series1} fillOpacity={0.1} activeDot={activeDot(CHART_COLORS.series1)} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Purchases Over Time" subtitle={`Stock purchased from suppliers · ${rangeLabel}`} table={timeTable('purchases', 'Purchases', money)}>
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('purchases')} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={money} labelFormatter={shortDate} />} />
            <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS.series1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Revenue & Expenses"
        subtitle={`Sales revenue vs operating expenses · ${rangeLabel}`}
        legend={[{ label: 'Revenue', color: CHART_COLORS.series1 }, { label: 'Expenses', color: CHART_COLORS.series2 }]}
        table={{ columns: ['Date', 'Revenue', 'Expenses'], rows: daily.map((d) => [shortDate(d.date), money(d.revenue), money(d.expenses)]) }}
      >
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('revenue', 'expenses')} />
            {tooltip(money)}
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.series1} strokeWidth={2} dot={false} activeDot={activeDot(CHART_COLORS.series1)} />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.series2} strokeWidth={2} dot={false} activeDot={activeDot(CHART_COLORS.series2)} />
          </LineChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Profit Over Time" subtitle={`Revenue − cost of goods − expenses · ${rangeLabel}`} table={timeTable('profit', 'Profit', money)}>
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('profit')} />
            <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeWidth={1} />
            {tooltip(money)}
            <Area type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS.series1} strokeWidth={2} fill={CHART_COLORS.series1} fillOpacity={0.1} activeDot={activeDot(CHART_COLORS.series1)} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Sales by Branch"
        subtitle={branchId === 'all' ? `Revenue per branch · ${rangeLabel.replace('Daily · ', '')}` : `Selected branch highlighted · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Branch', 'Revenue'], rows: byBranch.map((b) => [b.fullName, money(b.revenue)]) }}
      >
        {emptyBar(byBranch) || (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byBranch} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} ticks={branchTicks} domain={[0, branchTicks[branchTicks.length - 1]]} interval={0} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={money} labelFormatter={(name) => byBranch.find((b) => b.name === name)?.fullName || name} />} />
            <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {byBranch.map((b) => (
                <Cell key={b.id} fill={branchId === 'all' || b.id === branchId ? CHART_COLORS.series1 : CHART_COLORS.deEmphasis} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Top-Selling Categories"
        subtitle={`Units sold by category · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Category', 'Units Sold', 'Revenue'], rows: byCategory.map((c) => [c.category, c.unitsSold.toLocaleString(), money(c.revenue)]) }}
      >
        {emptyBar(byCategory) || (
        <ResponsiveContainer width="100%" height={Math.max(220, byCategory.length * 30)}>
          <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
            <XAxis type="number" tickFormatter={compactNumber} {...axisProps} ticks={categoryTicks} domain={[0, categoryTicks[categoryTicks.length - 1]]} interval={0} />
            <YAxis
              type="category"
              dataKey="category"
              width={165}
              {...axisProps}
              axisLine={false}
              interval={0}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fill={CHART_COLORS.axis} fontSize={11}>{payload.value}</text>
              )}
            />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={(v) => `${v.toLocaleString()} units`} />} />
            <Bar dataKey="unitsSold" name="Units sold" fill={CHART_COLORS.series1} radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}
