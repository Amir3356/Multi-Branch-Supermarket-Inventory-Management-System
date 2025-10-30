import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  PackageCheck,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'

// Procurement Officer: the supplier sent good units in place of an approved return. They go back into the same
// batch at the same branch; there is no new procurement or payment, and they settle that much of the credit.
export default function ReceiveReplacementModal({ request, branchName, unitCost, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ qty: String(request.qty), note: '' })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const qty = Number(form.qty)
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= request.qty ? qty : 0


  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validQty) {
      setErrors({ qty: `Enter a whole number from 1 to ${request.qty}` })
      return
    }
    setIsSaving(true)
    try {
      await onSave({ qty: validQty, note: form.note.trim() || undefined })
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors || {}).length ? undefined : error.message })
      setIsSaving(false)
    }
  }

  const readOnlyField = (id, label, value) => (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input-field" value={value} readOnly disabled />
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="replacement-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <PackageCheck size={20} />
            </div>
            <div>
              <h2 id="replacement-title">Receive Replacement</h2>
              <p className="page-desc">Good units from the supplier in place of the returned ones. No new payment is made.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-grid">
            {readOnlyField('rep-product', 'Product Name', request.product)}
            {readOnlyField('rep-batch', 'Batch Number', request.batch)}
          </div>
          <div className="modal-grid">
            {readOnlyField('rep-supplier', 'Supplier', request.supplier)}
            {readOnlyField('rep-branch', 'Branch', branchName)}
          </div>
          <div className="modal-grid">
            {readOnlyField('rep-returned', 'Quantity Returned', `${request.qty} units`)}
            <div className="form-group">
              <label htmlFor="rep-qty">Quantity Received *</label>
              <input id="rep-qty" type="number" min="1" max={request.qty} step="1" autoFocus className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="rep-note">Note (optional)</label>
            <textarea id="rep-note" rows={2} maxLength={500} placeholder="e.g. delivery note number, or when the rest will come" className="input-field" value={form.note} onChange={(e) => update('note', e.target.value)} />
          </div>

          <div className="sale-summary">
            <div><small>Back into Stock</small><strong>{validQty} units</strong></div>
            <div><small>Credit Settled</small><strong className="sale-total">{formatMoney(validQty * unitCost)}</strong></div>
            <div><small>Credit Still Owed</small><strong>{formatMoney((request.qty - validQty) * unitCost)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <PackageCheck size={16} /> {isSaving ? 'Saving…' : 'Receive into Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
