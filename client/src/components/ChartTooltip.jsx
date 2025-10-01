// One tooltip for every chart: the value leads, the series name follows, keyed with a short line
export default function ChartTooltip({ active, payload, label, formatValue, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-key" style={{ background: p.color || p.payload?.fill }} />
          <strong>{formatValue(p.value, p.dataKey)}</strong>
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  )
}
