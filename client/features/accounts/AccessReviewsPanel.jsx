import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardCheck, Eye, RefreshCw } from 'lucide-react'
import { EmptyRow } from '../../components'
import { PERIOD_TYPES, fetchAccessReviews, formatPeriod, generateAccessReview } from './accessReviews'
import AccessReviewModal from './AccessReviewModal'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

/**
 * Access reviews: for a period (daily, weekly, quarterly, yearly or a custom range) the system lists all
 * users with their role and last login, flagging dormant accounts and role changes (privilege creep)
 * for the Owner to act on and sign off. Reports are made when the Owner generates one.
 */
export default function AccessReviewsPanel({ accounts, onDeactivate, onNotice }) {
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [period, setPeriod] = useState('quarterly')
  const [range, setRange] = useState({ from: '', to: today() })
  const [rangeError, setRangeError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')

  const load = useCallback(() => fetchAccessReviews()
    .then(setReviews)
    .catch((error) => onNotice({ type: 'error', text: error.message }))
    .finally(() => setIsLoading(false)), [onNotice])

  useEffect(() => {
    load()
  }, [load])

  const generate = async () => {
    if (period === 'custom') {
      if (!range.from || !range.to) return setRangeError('Choose both dates.')
      if (range.from > range.to) return setRangeError('The end date must be on or after the start date.')
    }
    setRangeError(null)
    setIsGenerating(true)
    try {
      const { review } = await generateAccessReview(period, range.from, range.to)
      setReviews((prev) => [review, ...prev])
      setOpenId(review.id)
    } catch (error) {
      const fieldMessage = Object.values(error.fieldErrors || {})[0]
      if (fieldMessage) setRangeError(fieldMessage)
      else onNotice({ type: 'error', text: error.message })
    } finally {
      setIsGenerating(false)
    }
  }

  const shown = reviews.filter((r) => typeFilter === 'all' || r.periodType === typeFilter)

  const replaceReview = (updated) => setReviews((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated, rows: undefined } : r)))

  return (
    <div className="sessions-section">
      <div className="section-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
        <h3><ClipboardCheck size={18} /> Access Reviews</h3>
        <p className="page-desc" style={{ maxWidth: '820px' }}>
          Lists every user with their role and last sign-in for a period, and flags dormant accounts and role changes so you can remove access that's no longer needed.
        </p>
      </div>

      {/* Generate a report for any period */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        <div className="form-group" style={{ minWidth: '220px', marginBottom: 0 }}>
          <label htmlFor="review-period">Report period</label>
          <select id="review-period" className="input-field" value={period} onChange={(e) => { setPeriod(e.target.value); setRangeError(null) }}>
            {Object.entries(PERIOD_TYPES).map(([value, { generate }]) => (
              <option key={value} value={value}>{generate}</option>
            ))}
          </select>
        </div>
        {period === 'custom' && (
          <>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="review-from">From</label>
              <input id="review-from" type="date" className="input-field" max={range.to || today()} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="review-to">To</label>
              <input id="review-to" type="date" className="input-field" min={range.from || undefined} max={today()} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </div>
          </>
        )}
        <button type="button" className="primary-action-btn" onClick={generate} disabled={isGenerating}>
          <RefreshCw size={16} /> {isGenerating ? 'Generating…' : 'Generate report'}
        </button>
        <div className="form-group" style={{ marginLeft: 'auto', minWidth: '180px', marginBottom: 0 }}>
          <label htmlFor="review-filter">Show</label>
          <select id="review-filter" className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All reports</option>
            {Object.entries(PERIOD_TYPES).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      {rangeError && <span className="error-msg">{rangeError}</span>}

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Type</th>
              <th>Users</th>
              <th>Dormant</th>
              <th>Role changes</th>
              <th>Needs attention</th>
              <th>Review</th>
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
                  <span className={`status-tag ${r.summary.needsAttention ? 'low-stock' : 'in-stock'}`}>
                    {r.summary.needsAttention ? `${r.summary.needsAttention} account${r.summary.needsAttention === 1 ? '' : 's'}` : 'None'}
                  </span>
                </td>
                <td className="nowrap">
                  {r.reviewedAt
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={r.reviewNote || ''}><CheckCircle2 size={14} /> Reviewed by {r.reviewedBy}</span>
                    : <span className="status-tag low-stock">Pending review</span>}
                </td>
                <td>
                  <button type="button" className="link-btn" onClick={() => setOpenId(r.id)}>
                    <Eye size={14} /> Open
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <EmptyRow colSpan={8}>
                {isLoading
                  ? 'Loading access reviews…'
                  : reviews.length ? 'No reports of this type yet.' : 'No access reviews yet. Choose a period above and click Generate report.'}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>

      {openId && (
        <AccessReviewModal
          reviewId={openId}
          accounts={accounts}
          onClose={() => setOpenId(null)}
          onReviewed={(updated) => {
            replaceReview(updated)
            onNotice({ type: 'success', text: `Access review for ${formatPeriod(updated)} marked as reviewed.` })
          }}
          onDeactivate={onDeactivate}
        />
      )}
    </div>
  )
}
