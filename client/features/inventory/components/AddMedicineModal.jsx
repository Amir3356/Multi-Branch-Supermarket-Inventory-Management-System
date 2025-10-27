import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  Pill,
  X,
  Save
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { findProcurementProduct, validateMedicinePrices } from '../services/inventoryRules'

// Inventory's Add Medicine: pick a paid procurement for this branch and set its product's selling price.
// What the Procurement Officer ordered (category, product, quantity, prices) is shown read-only.
export default function AddMedicineModal({ procurements, products, branchName, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ purchaseId: '', sellingPrice: '' })
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  const procurement = procurements.find((p) => p.id === form.purchaseId)
  const product = findProcurementProduct(products, procurement)
  const purchasePrice = procurement?.purchasePrice ?? 0
  const sellingPrice = Number(form.sellingPrice)

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // A product already on sale starts from its current selling price
      if (field === 'purchaseId') {
        const picked = procurements.find((p) => p.id === value)
        next.sellingPrice = String(findProcurementProduct(products, picked)?.sellingPrice ?? '')
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'purchaseId' ? { sellingPrice: undefined } : {}) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validateMedicinePrices(form, procurement, product, sellingPrice)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      medId: product.id,
      name: product.name,
      purchasePrice,
      sellingPrice: Math.round(sellingPrice * 100) / 100
    })
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
              <p className="page-desc">Set the selling price for stock the Procurement Officer bought for {branchName}.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="medicine-procurement">Procurement *</label>
            <select id="medicine-procurement" autoFocus className={`input-field ${errors.purchaseId ? 'error' : ''}`} value={form.purchaseId} onChange={(e) => update('purchaseId', e.target.value)} disabled={!procurements.length}>
              <option value="">{procurements.length ? 'Select procurement…' : `No paid procurements for ${branchName} yet`}</option>
              {procurements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product} · {p.qty} units · {p.supplier}
                </option>
              ))}
            </select>
            {errors.purchaseId && <span className="error-msg">{errors.purchaseId}</span>}
          </div>

          <div className="modal-grid">
            {readOnlyField('medicine-branch', 'Branch', branchName)}
            {readOnlyField('medicine-category', 'Category', procurement?.category ?? '—')}
          </div>
          {readOnlyField('medicine-product', 'Product Name', procurement?.product ?? '—')}
          <div className="modal-grid">
            {readOnlyField('medicine-qty', 'Quantity', procurement ? `${procurement.qty} units` : '—')}
            {readOnlyField('medicine-total', 'Total Cost', procurement ? formatMoney(procurement.total) : '—')}
          </div>
          <div className="form-group">
            <label htmlFor="medicine-selling-price">Unit Selling Price *</label>
            <input id="medicine-selling-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.sellingPrice ? 'error' : ''}`} value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} disabled={!procurement} />
            {errors.sellingPrice && <span className="error-msg">{errors.sellingPrice}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Unit Selling Price</small><strong>{procurement && sellingPrice > 0 ? formatMoney(sellingPrice) : '—'}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={!procurements.length}>
              <Save size={16} /> Save Medicine
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
