import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  Send,
  Undo2,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { procurementBatch } from '../../purchases/model/procurement'
import { EMPTY_RETURN_REQUEST_FORM, EXTRA_QUANTITY, claimedQty, toReturnRequestPayload } from '../model/returnRequest'
import { SUPPLIER_RETURN_REASONS } from '../model/supplierReturn'
import { validateReturnRequest } from '../services/returnRequestRules'

// Inventory Officer: ask the branch's Procurement Officer to send units of one batch back to its supplier
// (missing units, damage, expiry, …). The product and branch come from the Inventory row.
export default function ReturnRequestModal({ item, branchName, batches, requests, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_RETURN_REQUEST_FORM,
    // The row's own batch, when it came from one of these procurements
    procurementId: batches.find((p) => procurementBatch(p) === item.batch)?.id ?? (batches.length === 1 ? batches[0].id : '')
  }))
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const batch = batches.find((p) => p.id === form.procurementId)
  const unrequested = batch ? batch.qty - claimedQty(requests, batch.id) : 0
  // Can't ask for more than is left on the batch, nor more than the branch holds. Extra units were never counted in
  // either, so only the officer's count limits them.
  const isExtra = form.reason === EXTRA_QUANTITY
  const maxQty = isExtra ? Infinity : Math.max(0, Math.min(unrequested, item.stock))
  const qty = Number(form.qty)

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value, ...(field === 'procurementId' ? { qty: '' } : {}) }))
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined, ...(field === 'procurementId' ? { qty: undefined } : {}), ...(field === 'reason' ? { note: undefined } : {}) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateReturnRequest(form, { batch, qty, maxQty })
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSaving(true)
    try {
      await onSave(toReturnRequestPayload(form))
    } catch (error) {
      // Field errors from the API (e.g. the batch was requested meanwhile) show under their inputs
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
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="return-request-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <Undo2 size={20} />
            </div>
            <div>
              <h2 id="return-request-title">Request Supplier Return</h2>
              <p className="page-desc">Ask the Procurement Officer to send stock from {branchName} back to its supplier.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-grid">
            {readOnlyField('rr-category', 'Category', item.category)}
            {readOnlyField('rr-product', 'Product Name', item.name)}
          </div>

          <div className="form-group">
            <label htmlFor="rr-batch">Batch Number *</label>
            <select id="rr-batch" autoFocus className={`input-field ${errors.procurementId ? 'error' : ''}`} value={form.procurementId} onChange={(e) => update('procurementId', e.target.value)} disabled={!batches.length}>
              <option value="">{batches.length ? 'Select batch…' : 'No paid procurement for this product at this branch'}</option>
              {batches.map((p) => (
                <option key={p.id} value={p.id}>{procurementBatch(p)}</option>
              ))}
            </select>
            {errors.procurementId && <span className="error-msg">{errors.procurementId}</span>}
            {batch && !isExtra && <span className="field-hint">{item.stock} in stock at {branchName} · up to {maxQty} can be requested</span>}
          </div>

          <div className="modal-grid">
            {readOnlyField('rr-supplier', 'Supplier', batch?.supplier ?? '—')}
            {readOnlyField('rr-branch', 'Branch', branchName)}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="rr-qty">{isExtra ? 'Extra Units Counted *' : 'Quantity Returned *'}</label>
              <input id="rr-qty" type="number" min="1" max={isExtra ? undefined : maxQty || undefined} step="1" placeholder={isExtra ? 'Units more than ordered' : 'Units to send back'} className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!batch} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="rr-reason">Reason *</label>
              <select id="rr-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)}>
                <option value="">Select reason…</option>
                {SUPPLIER_RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          {isExtra && (
            <span className="field-hint">
              Extra units were never counted into stock or paid for: stock stays as it is and the supplier owes no credit.
              If the supplier lets you keep them, add them to stock with Edit after the request is rejected.
            </span>
          )}

          <div className="form-group">
            <label htmlFor="rr-note">Note {form.reason === 'Other' ? '*' : '(optional)'}</label>
            <textarea id="rr-note" rows={3} maxLength={500} placeholder="What's wrong, e.g. 4 boxes missing from the delivery" className={`input-field ${errors.note ? 'error' : ''}`} value={form.note} onChange={(e) => update('note', e.target.value)} />
            {errors.note && <span className="error-msg">{errors.note}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving || !batches.length}>
              <Send size={16} /> {isSaving ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
