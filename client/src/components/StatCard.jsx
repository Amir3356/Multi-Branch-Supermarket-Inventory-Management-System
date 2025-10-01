// Summary card: title, icon, big value, and a small chip underneath
export default function StatCard({ title, icon: Icon, tone = 'cyan', value, valueStyle, chip, chipTone = 'neutral', chipTitle }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        <div className={`stat-icon-wrapper ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value" style={valueStyle}>{value}</div>
      {chip != null && (
        <div className={`stat-chip ${chipTone}`} title={chipTitle}>
          {chip}
        </div>
      )}
    </div>
  )
}
