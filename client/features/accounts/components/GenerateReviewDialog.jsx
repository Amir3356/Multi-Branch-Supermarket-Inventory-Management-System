import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardCheck, RefreshCw, X } from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { generateAccessReview } from '../api/accessReviewsApi'
import { PERIOD_TYPES } from '../model/accessReview'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

// Pick a period (the current day, week, month, quarter or year so far, or a custom date range) and generate a review for it
export default function GenerateReviewDialog({ onClose, onGenerated }) {
  const [period, setPeriod] = useState('monthly')
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
      onGenerated(await generateAccessReview(period, range.from, range.to, 'current'))
    } catch (err) {
      setError(Object.values(err.fieldErrors || {})[0] || err.message)
      setIsGenerating(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="generate-review-title" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 id="generate-review-title">Generate user report</h2>
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

          {period === 'custom' && (
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
