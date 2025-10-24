import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardCheck, RefreshCw, X } from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { generateAccessReview } from '../api/accessReviewsApi'
import { PERIOD_TYPES, SCOPE_LABELS } from '../model/accessReview'
import { formatPeriod, periodRange } from '../services/accessReviews'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

const StatusTag = ({ complete }) => (
  <span className={`status-tag ${complete ? 'in-stock' : 'low-stock'}`}>{complete ? 'Complete' : 'Partial'}</span>
)

// One of the two choices for a period type: its name, the dates it covers, and the status it will have
function ScopeOption({ period, scope, selected, onSelect }) {
  const complete = scope === 'previous'
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0.9rem', cursor: 'pointer',
        borderRadius: '10px', border: `1px solid ${selected ? 'var(--primary-cyan)' : 'var(--border-subtle)'}`, background: selected ? 'rgba(6, 182, 212, 0.08)' : 'transparent'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <input type="radio" name="review-scope" value={scope} checked={selected} onChange={() => onSelect(scope)} style={{ accentColor: 'var(--primary-cyan)' }} />
        <span>
          <span className="fw-600">{SCOPE_LABELS[period][scope]}</span>
          <span className="field-hint" style={{ display: 'block' }}>
            {formatPeriod(periodRange(period, scope))} · {complete ? 'the whole period is over' : 'the period is still running'}
          </span>
        </span>
      </span>
      <StatusTag complete={complete} />
    </label>
  )
}

// Pick a period (this one so far, the last finished one, or a custom date range) and generate a review for it
export default function GenerateReviewDialog({ onClose, onGenerated }) {
  const [period, setPeriod] = useState('monthly')
  const [scope, setScope] = useState('previous')
  const [range, setRange] = useState({ from: '', to: today() })
  const [error, setError] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEscapeKey(onClose)

  const generate = async (e) => {
    e.preventDefault()
    if (period === 'custom') {
      if (!range.from || !range.to) return setError('Choose both dates.')
      if (range.from > range.to) return setError('The end date must be on or after the start date.')
    }
    setError(null)
    setIsGenerating(true)
    try {
      onGenerated(await generateAccessReview(period, range.from, range.to, scope))
    } catch (err) {
      setError(Object.values(err.fieldErrors || {})[0] || err.message)
      setIsGenerating(false)
    }
  }

  // A custom range is complete once it has ended; one that runs to today is still partial
  const customComplete = range.to && range.to < today()

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="generate-review-title" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 id="generate-review-title">Generate access review</h2>
              <p className="page-desc">Every user with their role and last sign-in for the period you choose.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={generate} noValidate>
          <div className="form-group">
            <label htmlFor="review-period">Report period</label>
            <select id="review-period" className="input-field" value={period} onChange={(e) => { setPeriod(e.target.value); setError(null) }} autoFocus>
              {Object.entries(PERIOD_TYPES).map(([value, { option }]) => (
                <option key={value} value={value}>{option}</option>
              ))}
            </select>
          </div>

          {period !== 'custom' ? (
            <div role="radiogroup" aria-label="Which period" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['previous', 'current'].map((s) => (
                <ScopeOption key={s} period={period} scope={s} selected={scope === s} onSelect={setScope} />
              ))}
              <span className="field-hint">
                Complete: covers the whole period. Partial: covers only up to now; generate it again after the period ends.
              </span>
            </div>
          ) : (
            <>
              <div className="modal-grid">
                <div className="form-group">
                  <label htmlFor="review-from">From</label>
                  <input id="review-from" type="date" className="input-field" max={range.to || today()} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="review-to">To</label>
                  <input id="review-to" type="date" className="input-field" min={range.from || undefined} max={today()} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
                </div>
              </div>
              {range.from && range.to && range.from <= range.to && (
                <span className="field-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Will be <StatusTag complete={customComplete} />
                  {customComplete ? 'the range has ended' : 'it runs to today, so it covers only up to now'}
                </span>
              )}
            </>
          )}

          {error && <span className="error-msg">{error}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-action-btn" disabled={isGenerating}>
              <RefreshCw size={16} /> {isGenerating ? 'Generating…' : 'Generate report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
