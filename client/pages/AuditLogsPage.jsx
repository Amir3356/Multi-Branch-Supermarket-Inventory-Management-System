import { FileText } from 'lucide-react'

export default function AuditLogsPage() {
  return (
    <div className="content-section-card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
      <div
        style={{
          display: 'inline-flex',
          padding: '1rem',
          borderRadius: '50%',
          background: 'rgba(6, 182, 212, 0.12)',
          color: 'var(--primary-cyan)',
          marginBottom: '1.25rem'
        }}
      >
        <FileText size={36} />
      </div>
      <h2 className="page-title" style={{ fontSize: '2rem', margin: 0 }}>
        Coming Soon
      </h2>
    </div>
  )
}
