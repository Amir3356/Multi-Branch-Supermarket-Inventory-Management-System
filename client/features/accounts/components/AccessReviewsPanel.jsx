import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, ClipboardCheck, Eye, RefreshCw, Trash2 } from 'lucide-react'
import { EmptyRow } from '../../../components'
import { deleteAccessReview, fetchAccessReviews } from '../api/accessReviewsApi'
import { PERIOD_TYPES } from '../model/accessReview'
import { formatPeriod, reportStatus } from '../services/accessReviews'
import AccessReviewModal from './AccessReviewModal'
import GenerateReviewDialog from './GenerateReviewDialog'

// Tabs that filter the list; All is the default so no report is hidden
const TABS = [['all', 'All'], ...Object.entries(PERIOD_TYPES).map(([value, { label }]) => [value, label])]

/**
 * Access reviews: for a period (daily, weekly, monthly, quarterly, yearly or a custom range) the system
 * lists all users with their role and last login, flagging dormant accounts and role changes (privilege
 * creep). Tabs filter the list; Generate report opens a dialog to make a new one.
 */
export default function AccessReviewsPanel({ accounts, onNotice }) {
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [tab, setTab] = useState('all')
  const [showGenerate, setShowGenerate] = useState(false)

  const load = useCallback(() => fetchAccessReviews()
    .then(setReviews)
    .catch((error) => onNotice({ type: 'error', text: error.message }))
    .finally(() => setIsLoading(false)), [onNotice])

  useEffect(() => {
    load()
  }, [load])

  // A new report (or a fresh copy of the same period, which replaces the old one) opens straight away
  const handleGenerated = ({ review, replacedIds = [] }) => {
    setReviews((prev) => [review, ...prev.filter((r) => !replacedIds.includes(r.id))])
    setShowGenerate(false)
    setTab('all')
    setOpenId(review.id)
  }

  const shown = tab === 'all' ? reviews : reviews.filter((r) => r.periodType === tab)
  const countOf = (key) => (key === 'all' ? reviews.length : reviews.filter((r) => r.periodType === key).length)

  const remove = async (review) => {
    if (!window.confirm(`Delete the ${PERIOD_TYPES[review.periodType]?.label.toLowerCase() || ''} access review for ${formatPeriod(review)}? This cannot be undone.`)) return
    try {
      await deleteAccessReview(review.id)
      setReviews((prev) => prev.filter((r) => r.id !== review.id))
      onNotice({ type: 'success', text: `Access review for ${formatPeriod(review)} deleted.` })
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <div className="sessions-section">
      <div className="section-header" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.25rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><ClipboardCheck size={18} /> Access Reviews</h3>
        <p className="page-desc" style={{ maxWidth: '820px', textAlign: 'center' }}>
          Lists every user with their role and last sign-in for a period, and flags dormant accounts and role changes so you can remove access that's no longer needed.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1rem' }}>
        <div className="view-toggle" role="tablist" aria-label="Filter access reviews by period" style={{ flexWrap: 'wrap' }}>
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} <span className="filter-count">{countOf(key)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="primary-action-btn" onClick={() => setShowGenerate(true)}>
          <RefreshCw size={16} /> Generate report
        </button>
      </div>

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Type</th>
              <th>Users</th>
              <th>Dormant</th>
              <th>Role changes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="nowrap fw-600">{formatPeriod(r)}</td>
                <td className="nowrap">
                  <span className="fw-600">{PERIOD_TYPES[r.periodType]?.label || r.periodType}</span>
                  <div className="field-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {r.scheduled ? <><CalendarClock size={12} /> Scheduled</> : `By ${r.generatedBy || 'Owner'}`}
                  </div>
                </td>
                <td>{r.summary.totalUsers}</td>
                <td>{r.summary.dormant}</td>
                <td>{r.summary.roleChanged}</td>
                <td>
                  {reportStatus(r) === 'Complete'
                    ? <span className="status-tag in-stock" title="Made after the period ended: covers the whole period">Complete</span>
                    : (
                      <span
                        className="status-tag low-stock"
                        title={`Made while the period was still running: covers up to ${new Date(r.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. Generate it again later for up-to-date data.`}
                      >
                        Partial
                      </span>
                    )}
                </td>
                <td>
                  <div className="row-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
                    <button type="button" className="link-btn" onClick={() => setOpenId(r.id)}>
                      <Eye size={14} /> Open
                    </button>
                    <button type="button" className="icon-danger-btn" onClick={() => remove(r)} title="Delete report" aria-label={`Delete access review for ${formatPeriod(r)}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <EmptyRow colSpan={7}>
                {isLoading
                  ? 'Loading access reviews…'
                  : tab === 'all'
                    ? 'No access reviews yet. Click Generate report to make one.'
                    : `No ${PERIOD_TYPES[tab].label.toLowerCase()} reports yet. Click Generate report to make one.`}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      {showGenerate && <GenerateReviewDialog onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} />}

      {openId && (
        <AccessReviewModal
          reviewId={openId}
          accounts={accounts}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
