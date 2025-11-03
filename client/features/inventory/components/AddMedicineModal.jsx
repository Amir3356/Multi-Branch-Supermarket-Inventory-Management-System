import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  Pill,
  X,
  Save
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { todayKey } from '../../../utils'
import { findProcurementProduct, validateMedicinePrices } from '../services/inventoryRules'

const EMPTY_FORM = { category: '', purchaseId: '', expiryDate: '', sellingPrice: '' }

// Inventory's Add Medicine: the Inventory Officer picks the category and product of stock that arrived (a paid order for
// this branch not added yet), enters the expiration date on the package and the selling price, and adds the units to
// stock under a batch number the system generates. They don't enter Inventory by themselves; until then the Procurement Officer sees the delivery as Pending.
// `arrivals`: paid orders and incoming transfers for this branch, not added yet. A transfer brings its expiry date
// with it (fixedExpiry), so that field is read-only for it.
export default function AddMedicineModal({ arrivals, products, branchName, formatMoney, onClose, onSave }) {
  const procurements = arrivals
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const categories = [...new Set(procurements.map((p) => p.category))].sort()
  const categoryOrders = procurements.filter((p) => p.category === form.category).sort((a, b) => a.product.localeCompare(b.product))
  // The same product can be waiting more than once: those show where each came from to tell them apart; transfers
  // always say which branch sent them
  const repeated = (name) => categoryOrders.filter((p) => p.product === name).length > 1
  const procurement = categoryOrders.find((p) => p.id === form.purchaseId)
  const product = findProcurementProduct(products, procurement)
  const sellingPrice = Number(form.sellingPrice)
  // Stock that has already expired can't be added
  const tomorrow = (() => {
    const d = new Date(`${todayKey()}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-CA')
  })()

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') Object.assign(next, { purchaseId: '', sellingPrice: '' })
      // A product already on sale starts from its current selling price
      if (field === 'purchaseId') {
        const picked = procurements.find((p) => p.id === value)
        next.sellingPrice = String(findProcurementProduct(products, picked)?.sellingPrice ?? '')
      }
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      form: undefined,
      ...(field === 'category' ? { purchaseId: undefined } : {}),
      ...(field === 'purchaseId' ? { sellingPrice: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateMedicinePrices(form, procurement, product, sellingPrice)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSaving(true)
    try {
      await onSave(procurement, Math.round(sellingPrice * 100) / 100, { expiryDate: form.expiryDate })
    } catch (error) {
      // Field errors from the API (e.g. the expiry date) show under their inputs
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
      <div className="modal-card" style={{ maxWidth: '560px' }} role="dialog" aria-modal="true" aria-labelledby="add-medicine-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Pill size={20} />
            </div>
            <div>
              <h2 id="add-medicine-title">Add Medicine</h2>
              <p className="page-desc">Add stock the Procurement Officer bought for {branchName} once it arrives, and set its selling price.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="medicine-category">Category *</label>
              <select id="medicine-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!procurements.length}>
                <option value="">{procurements.length ? 'Select category…' : 'Nothing waiting to be added'}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <span className="error-msg">{errors.category}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="medicine-product">Product Name *</label>
              <select id="medicine-product" className={`input-field ${errors.purchaseId ? 'error' : ''}`} value={form.purchaseId} onChange={(e) => update('purchaseId', e.target.value)} disabled={!form.category}>
                <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
                {categoryOrders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product}{repeated(p.product) || p.kind === 'transfer' ? ` · ${p.note}` : ''}
                  </option>
                ))}
              </select>
              {errors.purchaseId && <span className="error-msg">{errors.purchaseId}</span>}
            </div>
          </div>

          <div className="modal-grid">
            {readOnlyField('medicine-qty', 'Quantity', procurement ? `${procurement.qty} units` : '—')}
            {readOnlyField('medicine-total', 'Total Cost', procurement ? formatMoney(procurement.total) : '—')}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="medicine-expiry">Expiration Date *</label>
              {procurement?.fixedExpiry
                ? <input id="medicine-expiry" className="input-field" value={procurement.fixedExpiry} readOnly disabled title="Comes with the transferred stock" />
                : <input id="medicine-expiry" type="date" min={tomorrow} className={`input-field ${errors.expiryDate ? 'error' : ''}`} value={form.expiryDate} onChange={(e) => update('expiryDate', e.target.value)} disabled={!procurement} />}
              {errors.expiryDate && <span className="error-msg">{errors.expiryDate}</span>}
            </div>
          </div>

          {/* What one unit cost (from the procurement), next to what it will sell for */}
          <div className="modal-grid">
            {readOnlyField('medicine-purchase-price', 'Unit Purchase Price', procurement ? formatMoney(procurement.purchasePrice) : '—')}
            <div className="form-group">
              <label htmlFor="medicine-selling-price">Unit Selling Price *</label>
              <input id="medicine-selling-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.sellingPrice ? 'error' : ''}`} value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} disabled={!procurement} />
              {errors.sellingPrice && <span className="error-msg">{errors.sellingPrice}</span>}
            </div>
          </div>

          {/* Updates as the selling price is typed: what the whole quantity sells for */}
          <div className="sale-summary">
            <div><small>Unit Selling Price</small><strong>{procurement && sellingPrice > 0 ? formatMoney(sellingPrice) : '—'}</strong></div>
            <div><small>Total Selling Price</small><strong className="sale-total">{procurement && sellingPrice > 0 ? formatMoney(procurement.qty * sellingPrice) : '—'}</strong></div>
          </div>
          {procurement && sellingPrice > 0 && (
            <span className="field-hint">{procurement.qty} units × {formatMoney(sellingPrice)}</span>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={!procurements.length || isSaving}>
              <Save size={16} /> {isSaving ? 'Adding…' : 'Add to Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
