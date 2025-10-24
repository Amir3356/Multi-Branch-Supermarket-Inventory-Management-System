import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  X,
  PackageX
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { validateDamage } from '../services/damageRules'

const DAMAGE_REASONS = ['Broken / crushed packaging', 'Water damage', 'Contaminated', 'Temperature damage (cold chain)', 'Defective item', 'Other']

const EMPTY_DAMAGE_FORM = { branchId: '', category: '', key: '', qty: '', reason: '' }

// Records stock that was physically damaged and takes it out of the branch's sellable stock
export default function RecordDamageModal({ branches, inventory, categories, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_DAMAGE_FORM)
  const [errors, setErrors] = useState({})
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEscapeKey(onClose)

  const branchStock = inventory.filter((i) => i.branchId === form.branchId && i.stock > 0)
  const categoryCount = (category) => branchStock.filter((i) => i.category === category).length
  const branchProducts = branchStock.filter((i) => i.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = branchProducts.find((i) => i.key === form.key)
  const qty = Number(form.qty)
  const validQty = product && Number.isInteger(qty) && qty > 0 && qty <= product.stock ? qty : 0
  const lossValue = product ? validQty * product.purchasePrice : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'branchId' ? { category: '', key: '', qty: '' } : {}),
      ...(field === 'category' ? { key: '', qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'branchId' ? { category: undefined, key: undefined, qty: undefined } : {}),
      ...(field === 'category' ? { key: undefined, qty: undefined } : {})
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validateDamage(form, product, qty)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      branchId: form.branchId,
      medId: product.medId,
      product: product.name,
      category: product.category,
      batch: product.batch,
      qty,
      reason: form.reason,
      lossValue: Math.round(lossValue * 100) / 100
    })
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="record-damage-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper danger">
              <PackageX size={20} />
            </div>
            <div>
              <h2 id="record-damage-title">Record Damaged Item</h2>
              <p className="page-desc">Remove physically damaged stock so it is no longer counted as sellable.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="damage-branch">Branch *</label>
            <select id="damage-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
              <option value="">Select branch…</option>
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="damage-category">Category *</label>
            <select id="damage-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!form.branchId}>
              <option value="">{form.branchId ? 'Select category…' : 'Select a branch first'}</option>
              {categories.map((c) => {
                const count = categoryCount(c)
                return (
                  <option key={c} value={c} disabled={!count}>
                    {c} {count ? `(${count} ${count === 1 ? 'product' : 'products'})` : '(none in stock)'}
                  </option>
                )
              })}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="damage-product">Product Name *</label>
            <select id="damage-product" className={`input-field ${errors.key ? 'error' : ''}`} value={form.key} onChange={(e) => update('key', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {branchProducts.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name} · batch {i.batch} · {i.stock} in stock
                </option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="damage-qty">Damaged Quantity *</label>
              <input id="damage-qty" type="number" min="1" max={product?.stock} step="1" placeholder="Units damaged" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!product} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="damage-reason">Reason *</label>
              <select id="damage-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)}>
                <option value="">Select reason…</option>
                {DAMAGE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          <div className="sale-summary">
            <div><small>In Stock</small><strong>{product ? `${product.stock} units` : '—'}</strong></div>
            <div><small>Stock After</small><strong>{product ? `${product.stock - validQty} units` : '—'}</strong></div>
            <div><small>Loss Value</small><strong className="negative-text">{formatMoney(lossValue)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="danger-action-btn">
              <PackageX size={16} /> Record Damage
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
