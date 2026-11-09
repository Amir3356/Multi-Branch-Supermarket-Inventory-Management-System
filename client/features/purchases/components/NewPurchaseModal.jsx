import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  CreditCard,
  PackageCheck,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { EMPTY_PURCHASE_FORM, toProcurementPayload, unitPriceFrom } from '../model/procurement'
import { validatePurchase } from '../services/purchaseRules'

// Category and Product Name come from what the Purchase Officer adds on the Category & Product page (sidebar). An officer's Receiving Branch is the branch the Owner assigned them in Account Provision, and can't be changed.
export default function NewPurchaseModal({ branches, assignedBranchId, products, categories, suppliers, boughtBatches = new Set(), formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_PURCHASE_FORM, branchId: assignedBranchId || '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const activeBranches = branches.filter((b) => b.status === 'Active')
  const assignedBranch = assignedBranchId ? branches.find((b) => b.id === assignedBranchId) : null

  useEscapeKey(onClose)

  const categoryProducts = products.filter((p) => p.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  // The same product can be in a category more than once, each with its own Batch ID: names are listed once, then the
  // officer picks which Batch ID they are buying
  const productNames = [...new Set(categoryProducts.map((p) => p.name))]
  // A Batch ID is bought once: those with an order already (pending or paid) aren't offered again
  const openBatches = (name) => categoryProducts.filter((p) => p.name === name && !boughtBatches.has(p.batch))
  const batches = openBatches(form.productName).sort((a, b) => String(a.batch).localeCompare(String(b.batch)))
  const allBought = Boolean(form.productName) && batches.length === 0
  const product = batches.find((p) => p.id === form.medId)
  const qty = Number(form.qty)
  const totalCost = Number(form.totalCost)
  // The officer enters what the whole order costs; the unit price follows from it
  const unitPrice = unitPriceFrom(totalCost, qty)

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') {
        next.productName = ''
        next.medId = ''
      }
      if (field === 'productName') {
        // Only one Batch ID for this product: picked straight away
        const only = openBatches(value)
        next.medId = only.length === 1 ? only[0].id : ''
      }
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' || field === 'productName' ? { medId: undefined, productName: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const newErrors = validatePurchase(form, { product, qty, totalCost, assignedBranchId, assignedBranch })
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setSubmitting(true)
    setSubmitError('')
    try {
      // On success the page closes this modal and opens Chapa's checkout, so it stays in its submitting state
      await onSave(toProcurementPayload(form, product, qty, totalCost))
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
            {errors.category
              ? <span className="error-msg">{errors.category}</span>
              : !categories.length && <span className="field-hint">No categories yet. Add them on the Category & Product page in the sidebar.</span>}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-product">Product Name *</label>
            <select id="purchase-product" className={`input-field ${errors.productName ? 'error' : ''}`} value={form.productName} onChange={(e) => update('productName', e.target.value)} disabled={!form.category}>
              <option value="">{!form.category ? 'Select a category first' : productNames.length ? `Select product… (${productNames.length} in ${form.category})` : 'No products in this category'}</option>
              {productNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {errors.productName
              ? <span className="error-msg">{errors.productName}</span>
              : form.category && !categoryProducts.length && <span className="field-hint">Add products to {form.category} on the Category & Product page in the sidebar.</span>}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-batch">Batch ID *</label>
            <select id="purchase-batch" className={`input-field ${errors.medId ? 'error' : ''}`} value={form.medId} onChange={(e) => update('medId', e.target.value)} disabled={!form.productName}>
              <option value="">{!form.productName ? 'Select a product first' : allBought ? 'All Batch IDs already bought' : `Select Batch ID… (${batches.length} for ${form.productName})`}</option>
              {batches.map((p) => (
                <option key={p.id} value={p.id}>{p.batch || p.id}</option>
              ))}
            </select>
            {errors.medId
              ? <span className="error-msg">{errors.medId}</span>
              : allBought
              ? <span className="field-hint">Every Batch ID of {form.productName} was already bought. To buy it again, add it again on the Category & Product page: it gets a new Batch ID.</span>
              : form.productName && batches.length > 1 && <span className="field-hint">{form.productName} is in {form.category} {batches.length} times; the Batch ID says which one you are buying.</span>}
          </div>

          <div className="modal-grid">
            {field('qty', 'Quantity *', { type: 'number', min: '1', step: '1', placeholder: 'Units bought' })}
            {field('totalCost', 'Total Cost (ETB) *', { type: 'number', min: '0', step: '0.01', placeholder: 'What the whole order costs' })}
          </div>

          <div className="form-group">
            <label htmlFor="purchase-unit-price">Unit Purchase Price</label>
            <input id="purchase-unit-price" className="input-field" value={unitPrice == null ? '—' : formatMoney(unitPrice)} readOnly disabled />
            <span className="field-hint">Calculated: Total Cost ÷ Quantity</span>
          </div>

          {submitError && <span className="error-msg" role="alert">{submitError}</span>}

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={submitting}>
              <CreditCard size={16} /> {submitting ? 'Paying…' : 'Pay'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
