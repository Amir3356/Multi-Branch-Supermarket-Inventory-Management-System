import { useState } from 'react'
import {
  CreditCard,
  PackageCheck,
  X
} from 'lucide-react'
import { sameText } from '../../utils'
import { useEscapeKey } from '../../hooks'

const NEW_OPTION = '__new__'

const EMPTY_PURCHASE_FORM = { branchId: '', supplier: '', categoryChoice: '', newCategory: '', productChoice: '', newProduct: '', qty: '', purchasePrice: '' }


// Category and Product Name are picked from what was purchased before; "+ Add new" lets the pharmacist type a new one
export default function NewPurchaseModal({ branches, inventory, products, categories, suppliers, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PURCHASE_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEscapeKey(onClose)

  const isNewCategory = form.categoryChoice === NEW_OPTION
  const isNewProduct = form.productChoice === NEW_OPTION
  const category = isNewCategory ? form.newCategory.trim() : form.categoryChoice
  const categoryProducts = isNewCategory ? [] : products.filter((p) => p.category === form.categoryChoice).sort((a, b) => a.name.localeCompare(b.name))
  const existingProduct = !isNewProduct ? products.find((p) => p.id === form.productChoice) : null
  const productName = isNewProduct ? form.newProduct.trim() : existingProduct?.name || ''
  const currentStock = existingProduct ? inventory.find((i) => i.branchId === form.branchId && i.medId === existingProduct.id)?.stock ?? 0 : 0
  const qty = Number(form.qty)
  const purchasePrice = Number(form.purchasePrice)
  const validQty = Number.isInteger(qty) && qty > 0 ? qty : 0
  const total = validQty && purchasePrice > 0 ? validQty * purchasePrice : 0

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'categoryChoice') {
        // A new category has no products yet, so the product must be new too
        Object.assign(next, { productChoice: value === NEW_OPTION ? NEW_OPTION : '', newProduct: '', purchasePrice: '' })
      }
      if (field === 'productChoice') {
        next.purchasePrice = value === NEW_OPTION ? '' : String(products.find((p) => p.id === value)?.purchasePrice ?? '')
      }
      return next
    })
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'categoryChoice' ? { newCategory: undefined, productChoice: undefined, newProduct: undefined } : {}),
      ...(field === 'productChoice' ? { newProduct: undefined, purchasePrice: undefined } : {})
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    const newErrors = {}
    if (!form.branchId) newErrors.branchId = 'Select the branch receiving the stock'
    if (!form.supplier.trim()) newErrors.supplier = 'Supplier is required'

    if (!form.categoryChoice) newErrors.categoryChoice = 'Select a category, or add a new one'
    else if (isNewCategory && !category) newErrors.newCategory = 'Enter the new category name'
    else if (isNewCategory && categories.some((c) => sameText(c, category))) newErrors.newCategory = `${categories.find((c) => sameText(c, category))} already exists. Pick it from the list.`

    if (!form.productChoice) newErrors.productChoice = form.categoryChoice ? 'Select a product, or add a new one' : 'Select a category first'
    else if (isNewProduct && !productName) newErrors.newProduct = 'Enter the new product name'
    else if (isNewProduct) {
      const duplicate = products.find((p) => sameText(p.name, productName))
      if (duplicate) newErrors.newProduct = `${duplicate.name} already exists under ${duplicate.category}. Pick it from the list.`
    }

    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    if (form.purchasePrice === '' || Number.isNaN(purchasePrice) || purchasePrice <= 0) newErrors.purchasePrice = 'Enter a price greater than 0'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setSubmitting(true)
    setSubmitError('')
    try {
      // On success the page leaves for Chapa's checkout, so the modal stays in its submitting state
      await onSave({
        branchId: form.branchId,
        supplier: form.supplier.trim(),
        category,
        product: productName,
        medId: existingProduct?.id || null,
        purchasePrice: Math.round(purchasePrice * 100) / 100,
        qty
      })
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

  return (
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
              <select id="purchase-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
                <option value="">Select branch…</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
            </div>
            {field('supplier', 'Supplier *', { placeholder: 'Supplier name', list: 'purchase-suppliers' })}
            <datalist id="purchase-suppliers">
              {suppliers.map((sup) => <option key={sup} value={sup} />)}
            </datalist>
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="purchase-category">Category *</label>
            <select id="purchase-category" className={`input-field ${errors.categoryChoice ? 'error' : ''}`} value={form.categoryChoice} onChange={(e) => update('categoryChoice', e.target.value)}>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={NEW_OPTION}>+ Add new category</option>
            </select>
            {errors.categoryChoice && <span className="error-msg">{errors.categoryChoice}</span>}
          </div>
          {isNewCategory && field('newCategory', 'New Category Name *', { placeholder: 'e.g. Herbal Remedies', autoFocus: true })}

          <div className="form-group">
            <label htmlFor="purchase-product">Product Name *</label>
            <select id="purchase-product" className={`input-field ${errors.productChoice ? 'error' : ''}`} value={form.productChoice} onChange={(e) => update('productChoice', e.target.value)} disabled={!form.categoryChoice || isNewCategory}>
              <option value="">{form.categoryChoice ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value={NEW_OPTION}>+ Add new product</option>
            </select>
            {errors.productChoice && <span className="error-msg">{errors.productChoice}</span>}
          </div>
          {isNewProduct && (
            <div className="form-group">
              {field('newProduct', 'New Product Name *', { placeholder: 'e.g. Ginger Root Tea (20 bags)', autoFocus: !isNewCategory })}
              <span className="field-hint new">New product: it will be added to Inventory. Set its selling price there with Add Medicine.</span>
            </div>
          )}

          <div className="modal-grid">
            {field('qty', 'Quantity *', { type: 'number', min: '1', step: '1', placeholder: 'Units bought' })}
            {field('purchasePrice', 'Purchase Price (per unit) *', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
          </div>

          <div className="sale-summary">
            <div><small>Current Stock</small><strong>{form.branchId && productName ? `${currentStock} units` : '—'}</strong></div>
            <div><small>Stock After</small><strong>{form.branchId && productName ? `${currentStock + validQty} units` : '—'}</strong></div>
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
    </div>
  )
}
