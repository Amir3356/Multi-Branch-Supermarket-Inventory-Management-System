import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  PackagePlus,
  X,
  Save
} from 'lucide-react'
import { useEscapeKey, useMoneyColumns } from '../../../hooks'
import { todayKey } from '../../../utils'
import { findProcurementProduct, validateReceivedStock } from '../services/inventoryRules'

const EMPTY_FORM = { category: '', productName: '', purchaseId: '', expiryDate: '', sellingPrice: '' }

// Inventory's Receive Stock: the Inventory Officer picks the category, the product and then the Batch ID of stock that
// arrived (a paid order for this branch not added yet: the Batch ID the Purchase Officer bought), enters the expiration
// date on the package and the selling price, and adds the units to stock under that Batch ID. They don't enter Inventory by themselves; until
// then the Purchase Officer sees the delivery as Pending.
// `arrivals`: paid orders and incoming transfers for this branch, not added yet. A transfer brings its expiry date
// with it (fixedExpiry), so that field is read-only for it.
export default function ReceiveStockModal({ arrivals, products, branchName, formatMoney, onClose, onSave }) {
  const procurements = arrivals
  const [form, setForm] = useState(EMPTY_FORM)
  // Total Cost shown as the Procurement page shows it: "Total Cost (ETB)" with the plain amount
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEscapeKey(onClose)

  const categories = [...new Set(procurements.map((p) => p.category))].sort()
  const categoryOrders = procurements.filter((p) => p.category === form.category).sort((a, b) => a.product.localeCompare(b.product))
  // Each product name once; the same product waiting more than once is told apart by its Batch ID
  const productNames = [...new Set(categoryOrders.map((p) => p.product))]
  const productOrders = categoryOrders.filter((p) => p.product === form.productName)
  const batchLabel = (p) => p.kind === 'transfer' ? `${p.batch} · ${p.note}` : `${p.productBatch || 'New batch'} · ${p.note}`
  const procurement = productOrders.find((p) => p.id === form.purchaseId)
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
      if (field === 'category') Object.assign(next, { productName: '', purchaseId: '', sellingPrice: '' })
      if (field === 'productName') {
        // Only one order of this product waiting: its Batch ID is picked straight away
        const only = categoryOrders.filter((p) => p.product === value)
        next.purchaseId = only.length === 1 ? only[0].id : ''
        const picked = only.length === 1 ? only[0] : null
        next.sellingPrice = picked ? String(findProcurementProduct(products, picked)?.sellingPrice ?? '') : ''
      }
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
      ...(field === 'category' || field === 'productName' ? { productName: undefined, purchaseId: undefined } : {}),
      ...(field === 'purchaseId' ? { sellingPrice: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateReceivedStock(form, procurement, product, sellingPrice)
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
      <div className="modal-card" style={{ maxWidth: '560px' }} role="dialog" aria-modal="true" aria-labelledby="receive-stock-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <PackagePlus size={20} />
            </div>
            <div>
              <h2 id="receive-stock-title">Receive Stock</h2>
              <p className="page-desc">Add stock the Purchase Officer bought for {branchName} once it arrives, and set its selling price.</p>
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
              <label htmlFor="stock-category">Category *</label>
              <select id="stock-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!procurements.length}>
                <option value="">{procurements.length ? 'Select category…' : 'Nothing waiting to be added'}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <span className="error-msg">{errors.category}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="stock-product">Product Name *</label>
              <select id="stock-product" className={`input-field ${errors.productName ? 'error' : ''}`} value={form.productName} onChange={(e) => update('productName', e.target.value)} disabled={!form.category}>
                <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
                {productNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {errors.productName && <span className="error-msg">{errors.productName}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="stock-batch">Batch ID *</label>
            <select id="stock-batch" className={`input-field ${errors.purchaseId ? 'error' : ''}`} value={form.purchaseId} onChange={(e) => update('purchaseId', e.target.value)} disabled={!form.productName}>
              <option value="">{form.productName ? `Select Batch ID… (${productOrders.length} waiting)` : 'Select a product first'}</option>
              {productOrders.map((p) => (
                <option key={p.id} value={p.id}>{batchLabel(p)}</option>
              ))}
            </select>
            {errors.purchaseId
              ? <span className="error-msg">{errors.purchaseId}</span>
              : <span className="field-hint">The Batch ID the Purchase Officer bought; the stock is added under it.</span>}
          </div>

          <div className="modal-grid">
            {readOnlyField('stock-qty', 'Quantity', procurement ? `${procurement.qty} units` : '—')}
            {readOnlyField('stock-total', moneyHeader('Total Cost'), procurement ? formatAmount(procurement.total) : '—')}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="stock-expiry">Expiration Date *</label>
              {procurement?.fixedExpiry
                ? <input id="stock-expiry" className="input-field" value={procurement.fixedExpiry} readOnly disabled title="Comes with the transferred stock" />
                : <input id="stock-expiry" type="date" min={tomorrow} className={`input-field ${errors.expiryDate ? 'error' : ''}`} value={form.expiryDate} onChange={(e) => update('expiryDate', e.target.value)} disabled={!procurement} />}
              {errors.expiryDate && <span className="error-msg">{errors.expiryDate}</span>}
            </div>
          </div>

          {/* What one unit cost (from the procurement), next to what it will sell for */}
          <div className="modal-grid">
            {readOnlyField('stock-purchase-price', 'Unit Purchase Price', procurement ? formatMoney(procurement.purchasePrice) : '—')}
            <div className="form-group">
              <label htmlFor="stock-selling-price">Unit Selling Price *</label>
              <input id="stock-selling-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.sellingPrice ? 'error' : ''}`} value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} disabled={!procurement} />
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
