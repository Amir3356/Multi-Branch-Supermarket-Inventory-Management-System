import { Link } from 'react-router-dom'
import { ArrowRight, SearchX } from 'lucide-react'
import { PATHS } from '../routes/paths'

export default function NotFoundPage() {
  return (
    <div className="content-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary-cyan)', marginBottom: '1rem' }}>
        <SearchX size={36} />
      </div>
      <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Page not found</h2>
      <p className="page-desc" style={{ maxWidth: '420px', margin: '0 auto 1.5rem' }}>This page doesn&apos;t exist. Use the sidebar, or go back to the dashboard.</p>
      <Link to={PATHS.dashboard} className="link-btn" style={{ justifyContent: 'center' }}>
        Go to Dashboard <ArrowRight size={14} />
      </Link>
    </div>
  )
}
