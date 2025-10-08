import { useState } from 'react'
import {
  CheckCircle2,
  X,
  Save
} from 'lucide-react'
import { isWholeNumber } from '../../utils'

// Settings: one Minimum Stock Level that applies to every product at every branch
export default function MinStockLevelForm({ settings, onSave }) {
  const [value, setValue] = useState(String(settings.defaultMinStock))
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const isDirty = value !== String(settings.defaultMinStock)

  const handleSave = (e) => {
    e.preventDefault()
    if (!isWholeNumber(value, 0)) {
      setError('Enter a whole number of 0 or more')
      return
    }
    onSave({ ...settings, defaultMinStock: Number(value) })
    setValue(String(Number(value)))
    setNotice(`Saved. Any product with fewer than ${Number(value)} units at a branch will now show as Low Stock.`)
  }

  return (
    <div className="content-section-card settings-panel">
      <div className="section-header">
        <div>
          <h2 className="page-title">Policy</h2>
          <p className="page-desc">Applies to every product at all branches.</p>
        </div>
      </div>

      {notice && (
        <div className="success-notice">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <form className="settings-box min-stock-box" onSubmit={handleSave} noValidate>
        <div className="form-group">
          <label htmlFor="settings-min-stock">Minimum Stock Level (units)</label>
          <input
            id="settings-min-stock"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 4"
            className={`input-field ${error ? 'error' : ''}`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
              setNotice(null)
            }}
          />
          {error
            ? <span className="error-msg">{error}</span>
            : <span className="field-hint">A branch with fewer units than this is flagged Low Stock; at 0 it is Out of Stock.</span>}
        </div>
        <button type="submit" className="primary-action-btn" disabled={!isDirty}>
          <Save size={16} /> Save
        </button>
      </form>
    </div>
  )
}
