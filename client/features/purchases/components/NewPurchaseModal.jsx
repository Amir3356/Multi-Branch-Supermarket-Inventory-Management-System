import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  CreditCard,
  PackageCheck,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { EMPTY_PURCHASE_FORM, toProcurementPayload } from '../model/procurement'
import { validatePurchase } from '../services/purchaseRules'

// Category and Product Name are picked from the product catalog. An officer's Receiving Branch is the branch the Owner
// assigned them in Account Provision, and can't be changed here.
export default function NewPurchaseModal({ branches, assignedBranchId, inventory, products, categories, suppliers, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_PURCHASE_FORM, branchId: assignedBranchId || '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const activeBranches = branches.filter((b) => b.status === 'Active')
  const assignedBranch = assignedBranchId ? branches.find((b) => b.id === assignedBranchId) : null

  useEscapeKey(onClose)

  const categoryProducts = products.filter((p) => p.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = products.find((p) => p.id === form.medId)
  const currentStock = product ? inventory.find((i) => i.branchId === form.branchId && i.medId === product.id)?.stock ?? 0 : 0
  const qty = Number(form.qty)
  const purchasePrice = Number(form.purchasePrice)
  const validQty = Number.isInteger(qty) && qty > 0 ? qty : 0
  const total = validQty && purchasePrice > 0 ? validQty * purchasePrice : 0

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') Object.assign(next, { medId: '', purchasePrice: '' })
      if (field === 'medId') next.purchasePrice = String(products.find((p) => p.id === value)?.purchasePrice ?? '')
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { medId: undefined } : {}),
      ...(field === 'medId' ? { purchasePrice: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const newErrors = validatePurchase(form, { product, qty, purchasePrice, assignedBranchId, assignedBranch })
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setSubmitting(true)
    setSubmitError('')
    try {
      // On success the page closes this modal and opens Chapa's checkout, so it stays in its submitting state
      await onSave(toProcurementPayload(form, product, qty, purchasePrice))
    } catch (error) {
      setSubmitting(false)
      setSubmitError(error.message)
      setErrors(error.fieldErrors || {})
    }
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`purchase-${name}`}>{label}</label>
      <input id={`purchase-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={(e) => update(name, e.target.value)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-purchase-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <PackageCheck size={20} />
            </div>
            <div>
              <h2 id="new-purchase-title">Create Procurement</h2>
              <p className="page-desc">Buy stock from a supplier and pay through Chapa. Stock is received into the branch once the payment is confirmed.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="purchase-branch">Receiving Branch *</label>
              {assignedBranchId ? (
                <input id="purchase-branch" className={`input-field ${errors.branchId ? 'error' : ''}`} value={assignedBranch?.name || assignedBranchId} readOnly disabled title="Your assigned branch (set by the Owner in Account Provision)" />
              ) : (
                <select id="purchase-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
                  <option value="">Select branch…</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
            </div>
            {field('supplier', 'Supplier *', { placeholder: 'Supplier name', list: 'purchase-suppliers', autoFocus: Boolean(assignedBranchId) })}
            <datalist id="purchase-suppliers">
              {suppliers.map((sup) => <option key={sup} value={sup} />)}
            </datalist>
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="purchase-category">Category *</label>
            <select id="purchase-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-product">Product Name *</label>
            <select id="purchase-product" className={`input-field ${errors.medId ? 'error' : ''}`} value={form.medId} onChange={(e) => update('medId', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.medId && <span className="error-msg">{errors.medId}</span>}
          </div>

          <div className="modal-grid">
            {field('qty', 'Quantity *', { type: 'number', min: '1', step: '1', placeholder: 'Units bought' })}
            {field('purchasePrice', 'Purchase Price (per unit, ETB) *', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
          </div>

          <div className="sale-summary">
            <div><small>Current Stock</small><strong>{form.branchId && product ? `${currentStock} units` : '—'}</strong></div>
            <div><small>Stock After</small><strong>{form.branchId && product ? `${currentStock + validQty} units` : '—'}</strong></div>
            <div><small>Total Cost</small><strong className="sale-total">{formatMoney(total)}</strong></div>
          </div>

          {submitError && <span className="error-msg" role="alert">{submitError}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={submitting}>
              <CreditCard size={16} /> {submitting ? 'Opening Chapa…' : 'Create & Pay with Chapa'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
