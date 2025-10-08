import { useState } from 'react'
import {
  X,
  Undo2
} from 'lucide-react'
import { useEscapeKey } from '../../hooks'

const RETURN_REASONS = ['Wrong item', 'Adverse reaction', 'Expired or defective', 'Prescription changed', 'Changed mind', 'Other']

const RETURN_CONDITIONS = {
  Resellable: 'Unopened and fine: put back into the branch\'s stock',
  Damaged: 'Opened or faulty: write off as damaged'
}

const EMPTY_RETURN_FORM = { category: '', product: '', saleId: '', qty: '', reason: '', condition: '' }

// A customer brings back part or all of an earlier sale and is refunded at the sale's unit price
export default function CustomerReturnModal({ sales, returnedQty, branchById, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RETURN_FORM)
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  // Only sales that still have units left to return, narrowed by category and product
  const returnable = sales.filter((s) => s.qty - returnedQty(s.id) > 0)
  const returnCategories = [...new Set(returnable.map((s) => s.category))].sort()
  const categoryProducts = [...new Set(returnable.filter((s) => s.category === form.category).map((s) => s.product))].sort()
  const productSales = returnable.filter((s) => s.category === form.category && s.product === form.product)
  const sale = productSales.find((s) => s.id === form.saleId)
  const remaining = sale ? sale.qty - returnedQty(sale.id) : 0
  const unitPrice = sale ? sale.total / sale.qty : 0
  const qty = Number(form.qty)
  const validQty = sale && Number.isInteger(qty) && qty > 0 && qty <= remaining ? qty : 0
  const refund = validQty * unitPrice

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Each choice resets the ones that depend on it
      ...(field === 'category' ? { product: '', saleId: '', qty: '' } : {}),
      ...(field === 'product' ? { saleId: '', qty: '' } : {}),
      ...(field === 'saleId' ? { qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { product: undefined, saleId: undefined, qty: undefined } : {}),
      ...(field === 'product' ? { saleId: undefined, qty: undefined } : {}),
      ...(field === 'saleId' ? { qty: undefined } : {})
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.category) newErrors.category = 'Select a category'
    if (!form.product) newErrors.product = form.category ? 'Select a product' : 'Select a category first'
    if (!sale) newErrors.saleId = form.product ? 'Select the original sale' : 'Select a product first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (sale && qty > remaining) newErrors.qty = `Only ${remaining} ${remaining === 1 ? 'unit' : 'units'} from this sale can still be returned`
    if (!form.reason) newErrors.reason = 'Select a reason'
    if (!form.condition) newErrors.condition = 'Select the item condition'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({ sale, qty, reason: form.reason, condition: form.condition, refund: Math.round(refund * 100) / 100 })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="customer-return-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <Undo2 size={20} />
            </div>
            <div>
              <h2 id="customer-return-title">Record Customer Return</h2>
              <p className="page-desc">Refund a customer for items brought back from an earlier sale.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="return-category">Category *</label>
            <select id="return-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">{returnable.length ? 'Select category…' : 'No sales left to return'}</option>
              {returnCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="return-product">Product Name *</label>
            <select id="return-product" className={`input-field ${errors.product ? 'error' : ''}`} value={form.product} onChange={(e) => update('product', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {errors.product && <span className="error-msg">{errors.product}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="return-sale">Original Sale *</label>
            <select id="return-sale" className={`input-field ${errors.saleId ? 'error' : ''}`} value={form.saleId} onChange={(e) => update('saleId', e.target.value)} disabled={!form.product}>
              <option value="">{form.product ? 'Select sale…' : 'Select a product first'}</option>
              {productSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.date} · {s.customer} · {branchById(s.branchId)?.name} · {s.qty} sold
                </option>
              ))}
            </select>
            {errors.saleId && <span className="error-msg">{errors.saleId}</span>}
            {sale && (
              <span className="field-hint">
                {formatMoney(unitPrice)} per unit · {remaining} of {sale.qty} can be returned
              </span>
            )}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="return-qty">Quantity Returned *</label>
              <input id="return-qty" type="number" min="1" max={remaining || undefined} step="1" placeholder="Units returned" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!sale} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="return-reason">Reason *</label>
              <select id="return-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)}>
                <option value="">Select reason…</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="return-condition">Item Condition *</label>
            <select id="return-condition" className={`input-field ${errors.condition ? 'error' : ''}`} value={form.condition} onChange={(e) => update('condition', e.target.value)}>
              <option value="">Select condition…</option>
              {Object.entries(RETURN_CONDITIONS).map(([key, hint]) => (
                <option key={key} value={key}>{key} — {hint}</option>
              ))}
            </select>
            {errors.condition && <span className="error-msg">{errors.condition}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Unit Price</small><strong>{sale ? formatMoney(unitPrice) : '—'}</strong></div>
            <div><small>Stock</small><strong>{form.condition === 'Resellable' ? `+${validQty} back to shelf` : form.condition === 'Damaged' ? 'Written off' : '—'}</strong></div>
            <div><small>Refund</small><strong className="negative-text">{formatMoney(refund)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Undo2 size={16} /> Record Return
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
