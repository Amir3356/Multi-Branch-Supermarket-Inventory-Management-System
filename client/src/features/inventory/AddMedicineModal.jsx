import { useState } from 'react'
import {
  Pill,
  X,
  Save
} from 'lucide-react'
import { useEscapeKey } from '../../hooks'

// Inventory's Add Medicine: pick a product from the catalog (e.g. one added by a purchase) and set it up for sale
export default function AddMedicineModal({ products, categories, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ category: '', medId: '', purchasePrice: '', sellingPrice: '' })
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  const categoryProducts = products.filter((p) => p.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = products.find((p) => p.id === form.medId)
  const purchasePrice = Number(form.purchasePrice)
  const sellingPrice = Number(form.sellingPrice)
  const margin = purchasePrice > 0 && sellingPrice > 0 ? ((sellingPrice - purchasePrice) / sellingPrice) * 100 : null

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') Object.assign(next, { medId: '', purchasePrice: '', sellingPrice: '' })
      if (field === 'medId') {
        const picked = products.find((p) => p.id === value)
        next.purchasePrice = String(picked?.purchasePrice ?? '')
        next.sellingPrice = String(picked?.sellingPrice ?? '')
      }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'category' || field === 'medId' ? { medId: undefined, purchasePrice: undefined, sellingPrice: undefined } : {}) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.category) newErrors.category = 'Select a category'
    if (!product) newErrors.medId = form.category ? 'Select a product' : 'Select a category first'
    if (form.purchasePrice === '' || Number.isNaN(purchasePrice) || purchasePrice <= 0) newErrors.purchasePrice = 'Enter a purchase price greater than 0'
    if (form.sellingPrice === '' || Number.isNaN(sellingPrice) || sellingPrice <= 0) newErrors.sellingPrice = 'Enter a selling price greater than 0'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      medId: product.id,
      name: product.name,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      sellingPrice: Math.round(sellingPrice * 100) / 100
    })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="add-medicine-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Pill size={20} />
            </div>
            <div>
              <h2 id="add-medicine-title">Add Medicine</h2>
              <p className="page-desc">Set up a purchased product for sale across all branches.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="medicine-category">Category *</label>
            <select id="medicine-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">Select category…</option>
              {categories.map((c) => {
                const count = products.filter((p) => p.category === c).length
                return (
                  <option key={c} value={c} disabled={!count}>
                    {c} {count ? `(${count} ${count === 1 ? 'product' : 'products'})` : '(no products yet)'}
                  </option>
                )
              })}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="medicine-product">Product Name *</label>
            <select id="medicine-product" className={`input-field ${errors.medId ? 'error' : ''}`} value={form.medId} onChange={(e) => update('medId', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sellingPrice == null ? ' (selling price not set)' : ''}
                </option>
              ))}
            </select>
            {errors.medId && <span className="error-msg">{errors.medId}</span>}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="medicine-purchase-price">Purchase Price (per unit) *</label>
              <input id="medicine-purchase-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.purchasePrice ? 'error' : ''}`} value={form.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} disabled={!product} />
              {errors.purchasePrice && <span className="error-msg">{errors.purchasePrice}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="medicine-selling-price">Selling Price (per unit) *</label>
              <input id="medicine-selling-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.sellingPrice ? 'error' : ''}`} value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} disabled={!product} />
              {errors.sellingPrice && <span className="error-msg">{errors.sellingPrice}</span>}
            </div>
          </div>

          <div className="sale-summary">
            <div><small>Profit per Unit</small><strong>{purchasePrice > 0 && sellingPrice > 0 ? formatMoney(sellingPrice - purchasePrice) : '—'}</strong></div>
            <div><small>Selling Price</small><strong>{product && sellingPrice > 0 ? formatMoney(sellingPrice) : '—'}</strong></div>
            <div><small>Margin</small><strong className={margin != null && margin < 0 ? 'negative-text' : 'sale-total'}>{margin == null ? '—' : `${margin.toFixed(1)}%`}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Save size={16} /> Save Medicine
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
