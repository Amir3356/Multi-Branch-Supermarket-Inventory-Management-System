import { Users } from 'lucide-react'
import { PageHeader } from '../components'

export default function UserReportPage() {
  return (
    <div>
      <PageHeader
        title="User Report"
        description="Comprehensive user activity, role access reviews, and branch staff performance reports."
      />
      <div className="content-section-card" style={{ textAlign: 'center', padding: '4.5rem 2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '1.25rem',
            borderRadius: '50%',
            background: 'rgba(6, 182, 212, 0.12)',
            color: 'var(--primary-cyan)',
            marginBottom: '1.25rem',
            boxShadow: '0 0 25px rgba(6, 182, 212, 0.2)'
          }}
        >
          <Users size={38} />
        </div>
        <h2 className="page-title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          Coming Soon
        </h2>
        <p className="page-desc" style={{ maxWidth: '440px', margin: '0 auto', fontSize: '1rem' }}>
          Coming Soon text
        </p>
      </div>
    </div>
  )
}
