// Card around a chart: title, subtitle, optional legend, and a "View data" table
export default function ChartCard({ title, subtitle, legend, table, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
        {legend && (
          <div className="chart-legend">
            {legend.map((l) => (
              <span key={l.label}>
                <span className={`chart-legend-key ${l.shape || 'line'}`} style={{ background: l.color }} /> {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="chart-body">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>View data</summary>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
