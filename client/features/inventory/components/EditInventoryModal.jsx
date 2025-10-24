import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  X,
  Save,
  Pencil
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { validateInventoryItem } from '../services/inventoryRules'

// Edit one Inventory row: stock, batch and expiry belong to this branch; prices belong to the product at every branch
export default function EditInventoryModal({ item, branchName, onClose, onSave }) {
  const [form, setForm] = useState({
    stock: String(item.stock),
    batch: item.batch,
    expiry: item.expiry,
    purchasePrice: String(item.purchasePrice ?? ''),
    sellingPrice: item.sellingPrice == null ? '' : String(item.sellingPrice)
  })
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const purchasePrice = Number(form.purchasePrice)
    const sellingPrice = Number(form.sellingPrice)
    const newErrors = validateInventoryItem(form, purchasePrice, sellingPrice)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      stock: Number(form.stock),
      batch: form.batch.trim().toUpperCase(),
      expiry: form.expiry,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      sellingPrice: Math.round(sellingPrice * 100) / 100
    })
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`edit-inv-${name}`}>{label}</label>
      <input id={`edit-inv-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={update(name)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-inv-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Pencil size={20} />
            </div>
            <div>
              <h2 id="edit-inv-title">Edit Inventory Item</h2>
              <p className="page-desc">{item.name} at {branchName}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="edit-inv-name">Product Name</label>
              <input id="edit-inv-name" className="input-field" value={item.name} readOnly disabled />
            </div>
            <div className="form-group">
              <label htmlFor="edit-inv-branch">Branch</label>
              <input id="edit-inv-branch" className="input-field" value={branchName} readOnly disabled />
            </div>
          </div>

          <div className="modal-section-title">This branch</div>
          {field('stock', 'Current Stock (units) *', { type: 'number', min: '0', step: '1', autoFocus: true })}
          <div className="modal-grid">
            {field('batch', 'Batch Number *', { placeholder: 'e.g. BT-9120' })}
            {field('expiry', 'Expiration Date *', { type: 'date' })}
          </div>

          <div className="modal-section-title">Prices · all branches</div>
          <div className="modal-grid">
            {field('purchasePrice', 'Purchase Price (per unit) *', { type: 'number', min: '0', step: '0.01' })}
            {field('sellingPrice', 'Selling Price (per unit) *', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
          </div>
          <span className="field-hint">Changing a price updates {item.name} at every branch.</span>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
