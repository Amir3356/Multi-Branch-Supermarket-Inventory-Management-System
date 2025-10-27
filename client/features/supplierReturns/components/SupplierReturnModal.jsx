import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  X,
  PackageMinus
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { procurementBatch } from '../../purchases/model/procurement'
import { SUPPLIER_RETURN_REASONS } from '../model/supplierReturn'
import { isExtraQuantity } from '../model/returnRequest'
import { validateSupplierReturn } from '../services/supplierReturnRules'

const EMPTY_SUPPLIER_RETURN_FORM = { category: '', product: '', purchaseId: '', qty: '', reason: '' }

// Sends bought stock back to the supplier; the supplier owes a credit at the purchase's unit cost.
// Opened from an Inventory Officer's request, every field comes from the request and is locked; heldQty is how many
// of its units this browser already took out of stock when the request was sent.
export default function SupplierReturnModal({ request, heldQty = 0, purchases, returnedQty, inventory, products, branchById, formatMoney, onClose, onSave }) {
  const locked = Boolean(request)
  const [form, setForm] = useState(request
    ? { category: request.category, product: request.product, purchaseId: request.procurementId, qty: String(request.qty), reason: request.reason }
    : EMPTY_SUPPLIER_RETURN_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  // Only paid purchases (their stock arrived) with units left to send back, narrowed by category and product.
  // Each purchase is one batch, so the same product can have several.
  const returnable = purchases.filter((p) => p.status === 'Paid' && p.qty - returnedQty(p.id) > 0)
  const returnCategories = [...new Set(returnable.map((p) => p.category))].sort()
  const categoryProducts = [...new Set(returnable.filter((p) => p.category === form.category).map((p) => p.product))].sort()
  const productPurchases = returnable.filter((p) => p.category === form.category && p.product === form.product)
  // From a request, its batch is used as is (the server already checked it)
  const purchase = locked ? purchases.find((p) => p.id === request.procurementId) : productPurchases.find((p) => p.id === form.purchaseId)

  const medId = purchase ? products.find((m) => m.name === purchase.product)?.id : null
  const branchStock = purchase ? inventory.find((i) => i.branchId === purchase.branchId && i.medId === medId)?.stock ?? 0 : 0
  // The request's own held units can go back to the supplier
  const available = branchStock + heldQty
  const unreturned = purchase ? purchase.qty - returnedQty(purchase.id) : 0
  // Can't send back more than was bought on this purchase, nor more than the branch still holds
  // Extra units (more than were ordered) were never in stock or paid for: no stock limit, no credit
  const isExtra = locked && isExtraQuantity(request)
  const maxReturn = isExtra ? Infinity : Math.min(unreturned, available)
  const unitCost = purchase ? purchase.total / purchase.qty : 0
  const qty = Number(form.qty)
  const validQty = purchase && Number.isInteger(qty) && qty > 0 && qty <= maxReturn ? qty : 0
  const credit = isExtra ? 0 : validQty * unitCost

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'category' ? { product: '', purchaseId: '', qty: '' } : {}),
      ...(field === 'product' ? { purchaseId: '', qty: '' } : {}),
      ...(field === 'purchaseId' ? { qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { product: undefined, purchaseId: undefined, qty: undefined } : {}),
      ...(field === 'product' ? { purchaseId: undefined, qty: undefined } : {}),
      ...(field === 'purchaseId' ? { qty: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const branchName = purchase ? branchById(purchase.branchId)?.name : ''
    const newErrors = validateSupplierReturn(form, { purchase, qty, maxReturn, unreturned, branchStock: available, branchName })
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSaving(true)
    try {
      await onSave({ purchase, medId, qty, reason: form.reason, credit: Math.round(credit * 100) / 100 })
    } catch (error) {
      setErrors({ form: error.message })
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="supplier-return-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <PackageMinus size={20} />
            </div>
            <div>
              <h2 id="supplier-return-title">{locked ? 'Approve Return Request' : 'Record Supplier Return'}</h2>
              <p className="page-desc">
                {locked
                  ? `Requested by ${request.requestedBy || 'the Inventory Officer'}${request.note ? `: “${request.note}”` : ''}`
                  : 'Send purchased stock back to the supplier for a credit.'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {errors.form && <span className="error-msg">{errors.form}</span>}
          <div className="form-group">
            <label htmlFor="sreturn-category">Category *</label>
            <select id="sreturn-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={locked}>
              <option value="">{returnable.length ? 'Select category…' : 'No purchases left to return'}</option>
              {returnCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sreturn-product">Product Name *</label>
            <select id="sreturn-product" className={`input-field ${errors.product ? 'error' : ''}`} value={form.product} onChange={(e) => update('product', e.target.value)} disabled={locked || !form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {errors.product && <span className="error-msg">{errors.product}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sreturn-purchase">Batch Number *</label>
            <select id="sreturn-purchase" className={`input-field ${errors.purchaseId ? 'error' : ''}`} value={form.purchaseId} onChange={(e) => update('purchaseId', e.target.value)} disabled={locked || !form.product}>
              <option value="">{form.product ? 'Select batch…' : 'Select a product first'}</option>
              {productPurchases.map((p) => (
                <option key={p.id} value={p.id}>
                  {procurementBatch(p)}
                </option>
              ))}
            </select>
            {errors.purchaseId && <span className="error-msg">{errors.purchaseId}</span>}
            {purchase && (
              <span className="field-hint">
                {formatMoney(unitCost)} per unit · {available} in stock at {branchById(purchase.branchId)?.name}
              </span>
            )}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="sreturn-supplier">Supplier</label>
              <input id="sreturn-supplier" className="input-field" value={purchase?.supplier ?? '—'} readOnly disabled />
            </div>
            <div className="form-group">
              <label htmlFor="sreturn-branch">Branch</label>
              <input id="sreturn-branch" className="input-field" value={purchase ? branchById(purchase.branchId)?.name ?? '—' : '—'} readOnly disabled />
            </div>
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="sreturn-qty">Quantity Returned *</label>
              <input id="sreturn-qty" type="number" min="1" max={maxReturn || undefined} step="1" placeholder="Units sent back" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={locked || !purchase} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="sreturn-reason">Reason *</label>
              <select id="sreturn-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)} disabled={locked}>
                <option value="">Select reason…</option>
                {SUPPLIER_RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          <div className="sale-summary">
            <div><small>Unit Cost</small><strong>{purchase ? formatMoney(unitCost) : '—'}</strong></div>
            <div><small>Stock After</small><strong>{purchase ? `${isExtra ? available : available - validQty} units` : '—'}</strong></div>
            <div><small>Supplier Credit</small><strong className="sale-total">{formatMoney(credit)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn" disabled={isSaving}>
              <PackageMinus size={16} /> {isSaving ? 'Saving…' : locked ? 'Approve & Record Return' : 'Record Return'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
