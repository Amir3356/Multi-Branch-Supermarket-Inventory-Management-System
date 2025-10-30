import { createPortal } from 'react-dom'
import { useState } from 'react'
import {
  ArrowLeftRight,
  X
} from 'lucide-react'
import { useEscapeKey } from '../../../hooks'
import { procurementBatch } from '../../purchases/model/procurement'
import { sameText } from '../../../utils'
import { validateTransfer } from '../services/transferRules'

const EMPTY_TRANSFER_FORM = { from: '', to: '', category: '', key: '', batch: '', qty: '' }

// assignedBranchId: staff always send from their own branch (shown read-only); the Owner (null) picks any branch
export default function NewTransferModal({ branches, assignedBranchId, inventory, purchases, categories, maxQty, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_TRANSFER_FORM, from: assignedBranchId || '' })
  const [errors, setErrors] = useState({})
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEscapeKey(onClose)

  // Products come from the sending branch's stock
  const sourceStock = inventory.filter((i) => i.branchId === form.from && i.stock > 0)
  const categoryCount = (category) => sourceStock.filter((i) => i.category === category).length
  const sourceProducts = sourceStock.filter((i) => i.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = sourceProducts.find((i) => i.key === form.key)
  const destinationEntry = product && inventory.find((i) => i.branchId === form.to && i.medId === product.medId)
  // The batches this product arrived in at the sending branch (one per paid procurement), plus the row's own batch
  const batches = product
    ? [...new Set([
        product.batch,
        ...purchases
          .filter((p) => p.status === 'Paid' && p.branchId === form.from && (p.medId === product.medId || sameText(p.product, product.name)))
          .map(procurementBatch)
      ].filter(Boolean))]
    : []
  const qty = Number(form.qty)
  const validQty = product && Number.isInteger(qty) && qty > 0 && qty <= product.stock ? qty : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Changing the sending branch or category resets the product picked from its stock
      ...(field === 'from' ? { category: '', key: '', qty: '' } : {}),
      ...(field === 'category' ? { key: '', qty: '' } : {}),
      // A product starts on its stock row's batch
      ...(field === 'key' ? { batch: inventory.find((i) => i.key === value)?.batch || '', qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'from' ? { to: undefined, category: undefined, key: undefined, qty: undefined } : {}),
      ...(field === 'category' ? { key: undefined, qty: undefined } : {}),
      ...(field === 'key' ? { batch: undefined } : {})
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = validateTransfer(form, product, qty, maxQty)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      from: form.from,
      to: form.to,
      product: product.name,
      medId: product.medId,
      batch: form.batch,
      expiry: product.expiry,
      qty
    })
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-transfer-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 id="new-transfer-title">New Stock Transfer</h2>
              <p className="page-desc">Move stock from one branch to another. Stock moves as soon as you confirm.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Branches</div>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="transfer-from">From Branch {assignedBranchId ? '' : '*'}</label>
              {assignedBranchId ? (
                <input id="transfer-from" className="input-field" value={branches.find((b) => b.id === assignedBranchId)?.name || assignedBranchId} readOnly disabled title="Your assigned branch (set by the Owner in Account Provision)" />
              ) : (
                <select id="transfer-from" autoFocus className={`input-field ${errors.from ? 'error' : ''}`} value={form.from} onChange={(e) => update('from', e.target.value)}>
                  <option value="">Select branch…</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              {errors.from && <span className="error-msg">{errors.from}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="transfer-to">To Branch *</label>
              <select id="transfer-to" autoFocus={Boolean(assignedBranchId)} className={`input-field ${errors.to ? 'error' : ''}`} value={form.to} onChange={(e) => update('to', e.target.value)}>
                <option value="">Select branch…</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id} disabled={b.id === form.from}>{b.name}</option>
                ))}
              </select>
              {errors.to && <span className="error-msg">{errors.to}</span>}
            </div>
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="transfer-category">Category *</label>
            <select id="transfer-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!form.from}>
              <option value="">{form.from ? 'Select category…' : 'Select the sending branch first'}</option>
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
            <label htmlFor="transfer-product">Product Name *</label>
            <select id="transfer-product" className={`input-field ${errors.key ? 'error' : ''}`} value={form.key} onChange={(e) => update('key', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {sourceProducts.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name} · {i.stock} available
                </option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="transfer-batch">Batch Number *</label>
            <select id="transfer-batch" className={`input-field ${errors.batch ? 'error' : ''}`} value={form.batch} onChange={(e) => update('batch', e.target.value)} disabled={!product}>
              <option value="">{product ? 'Select batch…' : 'Select a product first'}</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {errors.batch && <span className="error-msg">{errors.batch}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="transfer-qty">Quantity *</label>
            <input id="transfer-qty" type="number" min="1" max={product ? Math.min(product.stock, maxQty) : undefined} step="1" placeholder="Units to move" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!product} />
            {errors.qty && <span className="error-msg">{errors.qty}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Available at Source</small><strong>{product ? `${product.stock} units` : '—'}</strong></div>
            <div><small>Source After</small><strong>{product ? `${product.stock - validQty} units` : '—'}</strong></div>
            <div><small>Destination After</small><strong>{product && form.to ? `${(destinationEntry?.stock || 0) + validQty} units` : '—'}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <ArrowLeftRight size={16} /> Transfer Stock
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
