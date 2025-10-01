import { useState } from 'react'
import {
  X,
  PackageMinus
} from 'lucide-react'
import { useEscapeKey } from '../../hooks'

const SUPPLIER_RETURN_REASONS = ['Expired / near expiry', 'Damaged on arrival', 'Wrong item delivered', 'Product recall', 'Overstock']

const EMPTY_SUPPLIER_RETURN_FORM = { category: '', product: '', purchaseId: '', qty: '', reason: '' }

// Sends bought stock back to the supplier; the supplier owes a credit at the purchase's unit cost
export default function SupplierReturnModal({ purchases, returnedQty, inventory, products, branchById, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_SUPPLIER_RETURN_FORM)
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

  // Only purchases that still have units left to send back, narrowed by category and product
  const returnable = purchases.filter((p) => p.qty - returnedQty(p.id) > 0)
  const returnCategories = [...new Set(returnable.map((p) => p.category))].sort()
  const categoryProducts = [...new Set(returnable.filter((p) => p.category === form.category).map((p) => p.product))].sort()
  const productPurchases = returnable.filter((p) => p.category === form.category && p.product === form.product)
  const purchase = productPurchases.find((p) => p.id === form.purchaseId)

  const medId = purchase ? products.find((m) => m.name === purchase.product)?.id : null
  const branchStock = purchase ? inventory.find((i) => i.branchId === purchase.branchId && i.medId === medId)?.stock ?? 0 : 0
  const unreturned = purchase ? purchase.qty - returnedQty(purchase.id) : 0
  // Can't send back more than was bought on this purchase, nor more than the branch still holds
  const maxReturn = Math.min(unreturned, branchStock)
  const unitCost = purchase ? purchase.total / purchase.qty : 0
  const qty = Number(form.qty)
  const validQty = purchase && Number.isInteger(qty) && qty > 0 && qty <= maxReturn ? qty : 0
  const credit = validQty * unitCost

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

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.category) newErrors.category = 'Select a category'
    if (!form.product) newErrors.product = form.category ? 'Select a product' : 'Select a category first'
    if (!purchase) newErrors.purchaseId = form.product ? 'Select the original purchase' : 'Select a product first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (purchase && maxReturn === 0) newErrors.qty = `${branchById(purchase.branchId)?.name} has no ${purchase.product} left to send back`
    else if (purchase && qty > maxReturn) {
      newErrors.qty = qty > unreturned
        ? `Only ${unreturned} units from this purchase can still be returned`
        : `${branchById(purchase.branchId)?.name} only has ${branchStock} units in stock`
    }
    if (!form.reason) newErrors.reason = 'Select a reason'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({ purchase, medId, qty, reason: form.reason, credit: Math.round(credit * 100) / 100 })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="supplier-return-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <PackageMinus size={20} />
            </div>
            <div>
              <h2 id="supplier-return-title">Record Supplier Return</h2>
              <p className="page-desc">Send purchased stock back to the supplier for a credit.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="sreturn-category">Category *</label>
            <select id="sreturn-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">{returnable.length ? 'Select category…' : 'No purchases left to return'}</option>
              {returnCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sreturn-product">Product Name *</label>
            <select id="sreturn-product" className={`input-field ${errors.product ? 'error' : ''}`} value={form.product} onChange={(e) => update('product', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {errors.product && <span className="error-msg">{errors.product}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sreturn-purchase">Original Purchase *</label>
            <select id="sreturn-purchase" className={`input-field ${errors.purchaseId ? 'error' : ''}`} value={form.purchaseId} onChange={(e) => update('purchaseId', e.target.value)} disabled={!form.product}>
              <option value="">{form.product ? 'Select purchase…' : 'Select a product first'}</option>
              {productPurchases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.date} · {p.supplier} · {branchById(p.branchId)?.name} · {p.qty} bought
                </option>
              ))}
            </select>
            {errors.purchaseId && <span className="error-msg">{errors.purchaseId}</span>}
            {purchase && (
              <span className="field-hint">
                {formatMoney(unitCost)} per unit · {unreturned} of {purchase.qty} can be returned · {branchStock} in stock at {branchById(purchase.branchId)?.name}
              </span>
            )}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="sreturn-qty">Quantity Returned *</label>
              <input id="sreturn-qty" type="number" min="1" max={maxReturn || undefined} step="1" placeholder="Units sent back" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!purchase} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="sreturn-reason">Reason *</label>
              <select id="sreturn-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)}>
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
            <div><small>Stock After</small><strong>{purchase ? `${branchStock - validQty} units` : '—'}</strong></div>
            <div><small>Supplier Credit</small><strong className="sale-total">{formatMoney(credit)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <PackageMinus size={16} /> Record Return
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
