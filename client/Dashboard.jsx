import { useState, useEffect, useMemo } from 'react'
import {
  useTable,
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  sortFn_text,
  sortFn_basic
} from '@tanstack/react-table'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts'
import {
  LayoutDashboard,
  Pill,
  Package,
  Clock,
  FileText,
  LogOut,
  Search,
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ShoppingCart,
  Receipt,
  BarChart3,
  PackageCheck,
  DollarSign,
  Wallet,
  Building2,
  ArrowLeftRight,
  X,
  Save,
  Landmark,
  Trash2,
  Pencil,
  Power,
  ShieldCheck,
  Bell,
  CheckCheck,
  Mail,
  MailOpen,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react'

// Static mock data (direct JSON imports, no API calls)
import INITIAL_BRANCHES from './data/branches.json'
import MEDICINES from './data/medicines.json'
import BRANCH_STOCK from './data/branchStock.json'
import SALES from './data/sales.json'
import PURCHASES from './data/purchases.json'
import PAYMENTS from './data/supplierPayments.json'
import TRANSFERS from './data/transfers.json'
import GOVERNMENT_TAXES from './data/governmentTaxes.json'
import EXPENSE_CATEGORIES from './data/expenseCategories.json'
import CATEGORIES from './data/categories.json'
import EXPENSES from './data/expenses.json'
import DAILY_PERFORMANCE from './data/dailyPerformance.json'
import CATEGORY_SALES from './data/categorySales.json'

const STATUS_TONE = {
  'In Stock': 'in-stock',
  'Low Stock': 'low-stock',
  'Expiring Soon': 'expiring-soon',
  'Paid': 'in-stock',
  'Cleared': 'in-stock',
  'Received': 'in-stock',
  'Active': 'in-stock',
  'Completed': 'in-stock',
  'Inactive': 'inactive'
}

const CURRENCIES = {
  USD: { symbol: '$', label: 'US Dollar ($)' },
  ETB: { symbol: 'Br ', label: 'Ethiopian Birr (Br)' },
  EUR: { symbol: '€', label: 'Euro (€)' }
}

const DEFAULT_SETTINGS = {
  pharmacyName: 'PharmaCare',
  currency: 'USD',
  defaultBranch: 'all',
  expiryWarningDays: 60,
  lowStockAlerts: true,
  expiryAlerts: true,
  reorderLevels: Object.fromEntries(MEDICINES.map((m) => [m.id, m.reorderLevel])),
  tax: {
    version: 3,
    rates: GOVERNMENT_TAXES
  },
  expenseCategories: EXPENSE_CATEGORIES,
  receiptFooter: 'Thank you for choosing us. Get well soon!',
  requirePrescription: true,
  maxTransferQty: 500,
  emailAlerts: true,
  dailySummary: false,
  notificationEmail: ''
}

const SETTINGS_STORAGE_KEY = 'pharmacare-settings'

// Occurrences per year; One-time expenses are not repeated
const EXPENSE_FREQUENCIES = { 'One-time': 0, Daily: 365, Weekly: 52, Monthly: 12, Quarterly: 4, Yearly: 1 }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Earlier versions also stored sales taxes and a tax type. Only yearly government taxes
// with a percentage rate are kept (fixed annual fees are not percentages, so they are dropped).
const migrateTaxRates = (rates = []) =>
  rates
    .filter((r) => ['Annual', 'Profit', 'Turnover'].includes(r.type))
    .map((r) => ({
      id: r.id,
      name: r.name,
      rate: Number(r.rate) || 0,
      dueMonth: r.dueMonth || 10,
      dueDay: r.dueDay || 31,
      status: r.status || 'Active'
    }))

const loadSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY))
    if (!saved) return DEFAULT_SETTINGS
    const merged = {
      ...DEFAULT_SETTINGS,
      ...saved,
      reorderLevels: { ...DEFAULT_SETTINGS.reorderLevels, ...saved.reorderLevels },
      tax: saved.tax?.version === 3 ? saved.tax : DEFAULT_SETTINGS.tax,
      expenseCategories: saved.expenseCategories || DEFAULT_SETTINGS.expenseCategories
    }
    if (saved.tax && saved.tax.version !== 3) {
      const migrated = migrateTaxRates(saved.tax.rates)
      if (migrated.length) merged.tax = { version: 3, rates: migrated }
    }
    delete merged.taxPayments // annual tax payment tracking was removed
    delete merged.taxRate // replaced by the tax configuration
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

const NOTIFICATIONS_STORAGE_KEY = 'pharmacare-notifications'
const TAX_REMINDER_DAYS = 60

// Read / dismissed notification ids are a per-viewer convenience kept in the browser
const loadNotificationState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY))
    return { read: saved?.read || [], dismissed: saved?.dismissed || [] }
  } catch {
    return { read: [], dismissed: [] }
  }
}

const persistNotificationState = (state) => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable; read state lasts for this session only
  }
}

// Local calendar date as YYYY-MM-DD, matching the dates in the mock data
const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const daysUntil = (date) => Math.round((date - startOfToday()) / (1000 * 60 * 60 * 24))

const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Next yearly due date of a government tax on or after today
const nextTaxDueDate = (rate) => {
  const today = startOfToday()
  const thisYear = new Date(today.getFullYear(), rate.dueMonth - 1, rate.dueDay)
  return thisYear >= today ? thisYear : new Date(today.getFullYear() + 1, rate.dueMonth - 1, rate.dueDay)
}

const persistSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable (private mode); settings still apply for this session
  }
}

const formatMoneyIn = (currency, value) =>
  `${value < 0 ? '-' : ''}${CURRENCIES[currency]?.symbol || '$'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Status is derived from each branch's own stock level and batch expiry, using the configured rules
const getStockStatus = (stock, reorderLevel, expiry, settings) => {
  if (settings.lowStockAlerts && stock < reorderLevel) return 'Low Stock'
  const daysToExpiry = (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24)
  if (settings.expiryAlerts && daysToExpiry <= settings.expiryWarningDays) return 'Expiring Soon'
  return 'In Stock'
}

// Inventory rows: one row per medicine per branch
const buildInventory = (settings, stockLevels, products) =>
  stockLevels.map((entry) => {
    const med = products.find((m) => m.id === entry.medId)
    const reorderLevel = settings.reorderLevels[med.id] ?? med.reorderLevel
    return {
      ...med,
      ...entry,
      reorderLevel,
      key: `${entry.medId}-${entry.branchId}`,
      status: getStockStatus(entry.stock, reorderLevel, entry.expiry, settings)
    }
  })

function StatusTag({ status }) {
  return <span className={`status-tag ${STATUS_TONE[status] || 'in-stock'}`}>{status}</span>
}

function BranchTag({ branch }) {
  return (
    <span className="branch-tag" title={branch?.name}>
      <Building2 size={12} /> {branch?.name || 'Unknown Branch'}
    </span>
  )
}

const EMPTY_BRANCH_FORM = { name: '', location: '', status: 'Active' }

function BranchModal({ branch, branches, onClose, onSave }) {
  const isEdit = Boolean(branch?.id)
  const [form, setForm] = useState(isEdit ? { name: branch.name, location: branch.location, status: branch.status } : EMPTY_BRANCH_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const updateField = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = 'Branch name is required'
    else if (branches.some((b) => b.id !== branch?.id && b.name.toLowerCase() === form.name.trim().toLowerCase())) newErrors.name = 'A branch with this name already exists'

    if (!form.location.trim()) newErrors.location = 'Location is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      name: form.name.trim(),
      location: form.location.trim(),
      status: form.status
    })
  }

  const field = (name, label, placeholder, props = {}) => (
    <div className="form-group">
      <label htmlFor={`branch-${name}`}>{label}</label>
      <input
        id={`branch-${name}`}
        className={`input-field ${errors[name] ? 'error' : ''}`}
        placeholder={placeholder}
        value={form[name]}
        onChange={updateField(name)}
        {...props}
      />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-branch-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Building2 size={20} />
            </div>
            <div>
              <h2 id="add-branch-title">{isEdit ? 'Edit Branch' : 'Add New Branch'}</h2>
              <p className="page-desc">{isEdit ? `Update the details of ${branch.name}.` : 'Register a new pharmacy location in the network.'}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Branch Details</div>
          {field('name', 'Branch Name *', 'e.g. Northside Branch', { autoFocus: true })}
          {field('location', 'Location / Address *', 'Street, area, city')}
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="branch-status">Status</label>
              <select id="branch-status" className="input-field" value={form.status} onChange={updateField('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              {isEdit ? <><Save size={16} /> Save Changes</> : <><Plus size={16} /> Create Branch</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EMPTY_SALE_FORM = { branchId: '', customer: '', category: '', key: '', qty: '1' }

function NewSaleModal({ branches, inventory, categories, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_SALE_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Only products the chosen branch actually has in stock can be sold there
  const branchStock = inventory.filter((i) => i.branchId === form.branchId && i.stock > 0 && i.sellingPrice != null)
  const categoryCount = (category) => branchStock.filter((i) => i.category === category).length
  const branchProducts = branchStock
    .filter((i) => i.category === form.category)
    .sort((a, b) => a.name.localeCompare(b.name))
  const product = branchProducts.find((i) => i.key === form.key)
  const qty = Number(form.qty)
  const total = product && Number.isInteger(qty) && qty > 0 ? product.sellingPrice * qty : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Changing branch clears category and product (stock differs per branch); changing category clears product
      ...(field === 'branchId' ? { category: '', key: '', qty: '1' } : {}),
      ...(field === 'category' ? { key: '', qty: '1' } : {})
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
    const newErrors = {}
    if (!form.branchId) newErrors.branchId = 'Select the branch making this sale'
    if (!form.category) newErrors.category = form.branchId ? 'Select a category' : 'Select a branch first'
    if (!product) newErrors.key = form.category ? 'Select a product' : 'Select a category first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (product && qty > product.stock) newErrors.qty = `Only ${product.stock} units in stock at this branch`
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return

    onSave({
      branchId: form.branchId,
      customer: form.customer.trim() || 'Walk-in Customer',
      category: product.category,
      product: product.name,
      medId: product.medId,
      qty,
      total: Math.round(total * 100) / 100,
      status: 'Paid'
    })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-sale-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper teal">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 id="new-sale-title">New Sale</h2>
              <p className="page-desc">Record a sale to a customer at one of your branches.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="sale-branch">Branch *</label>
            <select id="sale-branch" autoFocus className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
              <option value="">Select branch…</option>
              {branches.filter((b) => b.status === 'Active').map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
          </div>

          <div className="modal-section-title">Customer</div>
          <div className="form-group">
            <label htmlFor="sale-customer">Customer Name</label>
            <input id="sale-customer" className="input-field" placeholder="Walk-in Customer" value={form.customer} onChange={(e) => update('customer', e.target.value)} />
          </div>

          <div className="modal-section-title">Product</div>
          <div className="form-group">
            <label htmlFor="sale-category">Category *</label>
            <select id="sale-category" className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)} disabled={!form.branchId}>
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
            <label htmlFor="sale-product">Product Name *</label>
            <select id="sale-product" className={`input-field ${errors.key ? 'error' : ''}`} value={form.key} onChange={(e) => update('key', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {branchProducts.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.name} — {formatMoney(i.sellingPrice)} · {i.stock} in stock
                </option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="sale-qty">Quantity *</label>
            <input id="sale-qty" type="number" min="1" max={product?.stock} step="1" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!product} />
            {errors.qty && <span className="error-msg">{errors.qty}</span>}
          </div>

          <div className="sale-summary">
            <div><small>In Stock</small><strong>{product ? `${product.stock} units` : '—'}</strong></div>
            <div><small>Unit Price</small><strong>{product ? formatMoney(product.sellingPrice) : '—'}</strong></div>
            <div><small>Total</small><strong className="sale-total">{formatMoney(total)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <CheckCircle2 size={16} /> Complete Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EMPTY_TRANSFER_FORM = { from: '', to: '', category: '', key: '', qty: '' }

function NewTransferModal({ branches, inventory, categories, maxQty, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_TRANSFER_FORM)
  const [errors, setErrors] = useState({})
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Products come from the sending branch's stock
  const sourceStock = inventory.filter((i) => i.branchId === form.from && i.stock > 0)
  const categoryCount = (category) => sourceStock.filter((i) => i.category === category).length
  const sourceProducts = sourceStock.filter((i) => i.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = sourceProducts.find((i) => i.key === form.key)
  const destinationEntry = product && inventory.find((i) => i.branchId === form.to && i.medId === product.medId)
  const qty = Number(form.qty)
  const validQty = product && Number.isInteger(qty) && qty > 0 && qty <= product.stock ? qty : 0

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Changing the sending branch or category resets the product picked from its stock
      ...(field === 'from' ? { category: '', key: '', qty: '' } : {}),
      ...(field === 'category' ? { key: '', qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'from' ? { to: undefined, category: undefined, key: undefined, qty: undefined } : {}),
      ...(field === 'category' ? { key: undefined, qty: undefined } : {})
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.from) newErrors.from = 'Select the branch sending the stock'
    if (!form.to) newErrors.to = 'Select the branch receiving the stock'
    else if (form.to === form.from) newErrors.to = 'Choose a different branch from the sending branch'
    if (!form.category) newErrors.category = form.from ? 'Select a category' : 'Select the sending branch first'
    if (!product) newErrors.key = form.category ? 'Select a product' : 'Select a category first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (product && qty > product.stock) newErrors.qty = `Only ${product.stock} units available at the sending branch`
    else if (qty > maxQty) newErrors.qty = `A single transfer can move at most ${maxQty} units`
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      from: form.from,
      to: form.to,
      product: product.name,
      medId: product.medId,
      batch: product.batch,
      expiry: product.expiry,
      qty,
      requestedBy: 'Pharmacist'
    })
  }

  return (
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
              <label htmlFor="transfer-from">From Branch *</label>
              <select id="transfer-from" autoFocus className={`input-field ${errors.from ? 'error' : ''}`} value={form.from} onChange={(e) => update('from', e.target.value)}>
                <option value="">Select branch…</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {errors.from && <span className="error-msg">{errors.from}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="transfer-to">To Branch *</label>
              <select id="transfer-to" className={`input-field ${errors.to ? 'error' : ''}`} value={form.to} onChange={(e) => update('to', e.target.value)}>
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
                  {i.name} · batch {i.batch} · {i.stock} available
                </option>
              ))}
            </select>
            {errors.key && <span className="error-msg">{errors.key}</span>}
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
    </div>
  )
}

const NEW_OPTION = '__new__'

const EMPTY_PURCHASE_FORM = { branchId: '', supplier: '', categoryChoice: '', newCategory: '', productChoice: '', newProduct: '', qty: '', purchasePrice: '' }

const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Category and Product Name are picked from what was purchased before; "+ Add new" lets the pharmacist type a new one
function NewPurchaseModal({ branches, inventory, products, categories, suppliers, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_PURCHASE_FORM)
  const [errors, setErrors] = useState({})
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

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

  const handleSubmit = (e) => {
    e.preventDefault()
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
    onSave({
      branchId: form.branchId,
      supplier: form.supplier.trim(),
      category,
      product: productName,
      medId: existingProduct?.id || null,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      qty,
      total: Math.round(total * 100) / 100
    })
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
              <h2 id="new-purchase-title">Create Purchase</h2>
              <p className="page-desc">Buy stock from a supplier and receive it into a branch.</p>
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

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <PackageCheck size={16} /> Create Purchase
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Inventory's Add Medicine: pick a product from the catalog (e.g. one added by a purchase) and set it up for sale
function AddMedicineModal({ products, categories, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState({ category: '', medId: '', sellingPrice: '' })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const categoryProducts = products.filter((p) => p.category === form.category).sort((a, b) => a.name.localeCompare(b.name))
  const product = products.find((p) => p.id === form.medId)
  const sellingPrice = Number(form.sellingPrice)
  const margin = product && sellingPrice > 0 ? ((sellingPrice - product.purchasePrice) / sellingPrice) * 100 : null

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') Object.assign(next, { medId: '', sellingPrice: '' })
      if (field === 'medId') next.sellingPrice = String(products.find((p) => p.id === value)?.sellingPrice ?? '')
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field !== 'sellingPrice' ? { medId: undefined, sellingPrice: undefined } : {}) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.category) newErrors.category = 'Select a category'
    if (!product) newErrors.medId = form.category ? 'Select a product' : 'Select a category first'
    if (form.sellingPrice === '' || Number.isNaN(sellingPrice) || sellingPrice <= 0) newErrors.sellingPrice = 'Enter a selling price greater than 0'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({ medId: product.id, name: product.name, sellingPrice: Math.round(sellingPrice * 100) / 100 })
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

          <div className="form-group">
            <label htmlFor="medicine-selling-price">Selling Price (per unit) *</label>
            <input id="medicine-selling-price" type="number" min="0" step="0.01" placeholder="0.00" className={`input-field ${errors.sellingPrice ? 'error' : ''}`} value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} disabled={!product} />
            {errors.sellingPrice && <span className="error-msg">{errors.sellingPrice}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Purchase Price</small><strong>{product ? formatMoney(product.purchasePrice) : '—'}</strong></div>
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

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="setting-toggle">
      <span className="setting-toggle-text">
        <span className="setting-toggle-label">{label}</span>
        {description && <span className="setting-toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
    </label>
  )
}

const isWholeNumber = (value, min, max = Infinity) => Number.isInteger(Number(value)) && value !== '' && Number(value) >= min && Number(value) <= max

function TaxRateModal({ rate, onClose, onSave }) {
  const [form, setForm] = useState({
    rate: rate.rate ?? '',
    dueMonth: rate.dueMonth || 10,
    dueDay: rate.dueDay ?? 31,
    status: rate.status || 'Active'
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (form.rate === '' || Number.isNaN(Number(form.rate))) newErrors.rate = 'Tax rate is required'
    else if (Number(form.rate) <= 0 || Number(form.rate) > 100) newErrors.rate = 'Enter a rate between 0 and 100'
    const daysInMonth = new Date(2023, Number(form.dueMonth), 0).getDate() // non-leap year, so Feb max is 28
    if (!Number.isInteger(Number(form.dueDay)) || Number(form.dueDay) < 1 || Number(form.dueDay) > daysInMonth) newErrors.dueDay = `Enter a day between 1 and ${daysInMonth}`
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      ...rate,
      rate: Number(form.rate),
      dueMonth: Number(form.dueMonth),
      dueDay: Number(form.dueDay),
      status: form.status
    })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="tax-modal-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Landmark size={20} />
            </div>
            <div>
              <h2 id="tax-modal-title">Configure {rate.name}</h2>
              <p className="page-desc">Applies to all branches.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="tax-name">Tax Name</label>
            <input id="tax-name" className="input-field" value={rate.name} readOnly disabled />
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="tax-rate">Tax Rate (%) *</label>
              <input id="tax-rate" type="number" min="0" max="100" step="0.01" autoFocus className={`input-field ${errors.rate ? 'error' : ''}`} value={form.rate} onChange={(e) => update('rate', e.target.value)} />
              {errors.rate && <span className="error-msg">{errors.rate}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="tax-due-month">Due Every Year *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select id="tax-due-month" aria-label="Due month" className="input-field" value={form.dueMonth} onChange={(e) => update('dueMonth', e.target.value)}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <input aria-label="Due day" type="number" min="1" max="31" className={`input-field ${errors.dueDay ? 'error' : ''}`} style={{ width: '80px' }} value={form.dueDay} onChange={(e) => update('dueDay', e.target.value)} />
              </div>
              {errors.dueDay && <span className="error-msg">{errors.dueDay}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tax-status">Status</label>
            <select id="tax-status" className="input-field" value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

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
    </div>
  )
}

function ExpenseCategoryModal({ category, categories, currency, onClose, onSave }) {
  const isEdit = Boolean(category.id)
  const [form, setForm] = useState({
    name: category.name || '',
    frequency: category.frequency || 'Monthly',
    amount: category.amount ?? '',
    status: category.status || 'Active'
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    const name = form.name.trim()
    if (!name) newErrors.name = 'Category name is required'
    else if (categories.some((c) => c.id !== category.id && c.name.toLowerCase() === name.toLowerCase())) newErrors.name = 'A category with this name already exists'
    if (form.amount !== '' && (Number.isNaN(Number(form.amount)) || Number(form.amount) < 0)) newErrors.amount = 'Enter 0 or a positive amount'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      id: category.id,
      name,
      frequency: form.frequency,
      amount: form.amount === '' ? 0 : Math.round(Number(form.amount) * 100) / 100,
      status: form.status
    })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper danger">
              <Wallet size={20} />
            </div>
            <div>
              <h2 id="expense-modal-title">{isEdit ? 'Edit Expense Category' : 'Add Expense Category'}</h2>
              <p className="page-desc">Available to all branches.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="expense-name">Category Name *</label>
            <input id="expense-name" autoFocus className={`input-field ${errors.name ? 'error' : ''}`} placeholder="e.g. Rent" value={form.name} onChange={(e) => update('name', e.target.value)} />
            {errors.name && <span className="error-msg">{errors.name}</span>}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="expense-frequency">Frequency *</label>
              <select id="expense-frequency" className="input-field" value={form.frequency} onChange={(e) => update('frequency', e.target.value)}>
                {Object.keys(EXPENSE_FREQUENCIES).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="expense-amount">Estimated Amount per Branch ({CURRENCIES[currency]?.symbol.trim() || '$'})</label>
              <input id="expense-amount" type="number" min="0" step="0.01" className={`input-field ${errors.amount ? 'error' : ''}`} placeholder="Optional" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
              {errors.amount && <span className="error-msg">{errors.amount}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="expense-status">Status</label>
            <select id="expense-status" className="input-field" value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Save size={16} /> {isEdit ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const pickAlertRules = (settings) => ({
  lowStockAlerts: settings.lowStockAlerts,
  expiryAlerts: settings.expiryAlerts,
  expiryWarningDays: settings.expiryWarningDays,
  reorderLevels: settings.reorderLevels
})

function PolicyPanel({ settings, branchCount, onSave }) {
  const [notice, setNotice] = useState(null)
  const [editingTax, setEditingTax] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)
  const [alertDraft, setAlertDraft] = useState(() => pickAlertRules(settings))
  const [alertErrors, setAlertErrors] = useState({})

  const money = (v) => formatMoneyIn(settings.currency, v)
  const savedAlerts = pickAlertRules(settings)
  const alertsDirty = JSON.stringify(alertDraft) !== JSON.stringify(savedAlerts)

  // Government taxes: pharmacists can configure them but not add or delete them
  const saveTax = (rate) => {
    onSave({ ...settings, tax: { ...settings.tax, rates: settings.tax.rates.map((r) => (r.id === rate.id ? rate : r)) } })
    setEditingTax(null)
    setNotice({ type: 'success', text: `${rate.name} was updated for all branches.` })
  }

  const toggleTaxStatus = (rate) => {
    const status = rate.status === 'Active' ? 'Inactive' : 'Active'
    saveTax({ ...rate, status })
    setNotice({ type: 'success', text: `${rate.name} is now ${status}.` })
  }

  // Expense categories: full create / edit / delete
  const commitExpenses = (expenseCategories) => onSave({ ...settings, expenseCategories })

  const saveExpense = (data) => {
    const exists = Boolean(data.id)
    if (exists) {
      commitExpenses(settings.expenseCategories.map((c) => (c.id === data.id ? data : c)))
    } else {
      const nextNumber = Math.max(0, ...settings.expenseCategories.map((c) => Number(String(c.id).split('-')[1]) || 0)) + 1
      commitExpenses([...settings.expenseCategories, { ...data, id: `EXP-${nextNumber}` }])
    }
    setEditingExpense(null)
    setNotice({ type: 'success', text: `${data.name} was ${exists ? 'updated' : 'added'}.` })
  }

  const toggleExpenseStatus = (category) => {
    const status = category.status === 'Active' ? 'Inactive' : 'Active'
    commitExpenses(settings.expenseCategories.map((c) => (c.id === category.id ? { ...c, status } : c)))
    setNotice({ type: 'success', text: `${category.name} is now ${status}.` })
  }

  const deleteExpense = (category) => {
    if (!window.confirm(`Delete the expense category "${category.name}"?`)) return
    commitExpenses(settings.expenseCategories.filter((c) => c.id !== category.id))
    setNotice({ type: 'success', text: `${category.name} was deleted.` })
  }

  // Stock alert rules: edited as a group, then saved
  const updateAlert = (field, value) => {
    setAlertDraft((prev) => ({ ...prev, [field]: value }))
    setAlertErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const updateReorderLevel = (medId, value) => {
    setAlertDraft((prev) => ({ ...prev, reorderLevels: { ...prev.reorderLevels, [medId]: value } }))
    setAlertErrors((prev) => ({ ...prev, [`reorder-${medId}`]: undefined }))
  }

  const saveAlerts = () => {
    const newErrors = {}
    if (!isWholeNumber(alertDraft.expiryWarningDays, 1, 365)) newErrors.expiryWarningDays = 'Enter 1–365 days'
    MEDICINES.forEach((m) => {
      if (!isWholeNumber(alertDraft.reorderLevels[m.id], 0)) newErrors[`reorder-${m.id}`] = 'Enter a whole number'
    })
    setAlertErrors(newErrors)
    if (Object.keys(newErrors).length) {
      setNotice({ type: 'error', text: 'Please fix the highlighted stock alert fields.' })
      return
    }
    const cleaned = {
      ...alertDraft,
      expiryWarningDays: Number(alertDraft.expiryWarningDays),
      reorderLevels: Object.fromEntries(Object.entries(alertDraft.reorderLevels).map(([id, v]) => [id, Number(v)]))
    }
    onSave({ ...settings, ...cleaned })
    setAlertDraft(cleaned)
    setNotice({ type: 'success', text: 'Stock alert rules saved for all branches.' })
  }

  const discardAlerts = () => {
    setAlertDraft(savedAlerts)
    setAlertErrors({})
  }

  const statusButton = (item, onToggle) => (
    <button
      type="button"
      className={`status-tag status-tag-btn ${STATUS_TONE[item.status]}`}
      onClick={() => onToggle(item)}
      title={`Click to make ${item.status === 'Active' ? 'Inactive' : 'Active'}`}
    >
      {item.status}
    </button>
  )

  return (
    <div className="content-section-card settings-panel">
      <div className="section-header">
        <div>
          <h2 className="page-title">Policy</h2>
          <p className="page-desc">Network-wide rules for government taxes, expenses, and stock alerts. Every policy applies to all branches.</p>
        </div>
      </div>

      {notice && (
        <div className={`success-notice ${notice.type}`}>
          {notice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Government Taxes */}
      <div className="settings-box" style={{ marginTop: '1.5rem' }}>
        <div className="settings-box-header">
          <div>
            <h4><Landmark size={16} /> Government Taxes</h4>
            <p className="page-desc">Taxes the pharmacy pays to the government every year. Taxes are set by the tax authority; you can configure the rate, due date, and status.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tax Name</th>
                <th>Tax Rate</th>
                <th>Due Every Year</th>
                <th>Status</th>
                <th style={{ width: '64px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.tax.rates.map((r) => (
                <tr key={r.id}>
                  <td className="fw-600">{r.name}</td>
                  <td>{Number(r.rate)}%</td>
                  <td>{MONTHS[r.dueMonth - 1]} {r.dueDay}</td>
                  <td>{statusButton(r, toggleTaxStatus)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => setEditingTax(r)} aria-label={`Configure ${r.name}`} title="Configure">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {settings.tax.rates.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                    No government taxes have been set up.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Categories */}
      <div className="settings-box" style={{ marginTop: '1.5rem' }}>
        <div className="settings-box-header">
          <div>
            <h4><Wallet size={16} /> Expense Categories</h4>
            <p className="page-desc">Custom expense categories every branch can record expenses against.</p>
          </div>
          <button type="button" className="primary-action-btn" onClick={() => setEditingExpense({})}>
            <Plus size={16} /> Add Category
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Frequency</th>
                <th>Est. Amount per Branch</th>
                <th>Yearly Estimate ({branchCount} {branchCount === 1 ? 'branch' : 'branches'})</th>
                <th>Status</th>
                <th style={{ width: '96px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.expenseCategories.map((c) => {
                const perYear = EXPENSE_FREQUENCIES[c.frequency]
                return (
                  <tr key={c.id}>
                    <td className="fw-600">{c.name}</td>
                    <td><span className="batch-badge">{c.frequency}</span></td>
                    <td>{c.amount ? money(c.amount) : '—'}</td>
                    <td>
                      {c.amount ? money(c.amount * (perYear || 1) * branchCount) : '—'}
                      {c.amount && !perYear ? <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}> (one-time)</span> : null}
                    </td>
                    <td>{statusButton(c, toggleExpenseStatus)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn" onClick={() => setEditingExpense(c)} aria-label={`Edit ${c.name}`} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="icon-danger-btn" onClick={() => deleteExpense(c)} aria-label={`Delete ${c.name}`} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {settings.expenseCategories.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                    No expense categories yet. Click Add Category to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Alert Rules */}
      <div className="settings-box" style={{ marginTop: '1.5rem' }}>
        <div className="settings-box-header">
          <div>
            <h4><AlertTriangle size={16} /> Stock Alert Rules</h4>
            <p className="page-desc">When stock is flagged as Low Stock or Expiring Soon at any branch.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {alertsDirty && <span className="unsaved-chip">Unsaved changes</span>}
            <button type="button" className="secondary-action-btn" onClick={discardAlerts} disabled={!alertsDirty}>
              Discard
            </button>
            <button type="button" className="primary-action-btn" onClick={saveAlerts} disabled={!alertsDirty}>
              <Save size={16} /> Save Rules
            </button>
          </div>
        </div>

        <div className="settings-grid">
          <div className="settings-form">
            <Toggle
              checked={alertDraft.expiryAlerts}
              onChange={(v) => updateAlert('expiryAlerts', v)}
              label="Expiring stock alerts"
              description="Flag batches that are close to their expiration date."
            />
            <div className="form-group">
              <label htmlFor="policy-expiry">Expiry Warning Window (days before expiry)</label>
              <input id="policy-expiry" type="number" min="1" max="365" className={`input-field ${alertErrors.expiryWarningDays ? 'error' : ''}`} value={alertDraft.expiryWarningDays} onChange={(e) => updateAlert('expiryWarningDays', e.target.value)} disabled={!alertDraft.expiryAlerts} />
              {alertErrors.expiryWarningDays && <span className="error-msg">{alertErrors.expiryWarningDays}</span>}
            </div>
          </div>

          <div className="settings-form">
            <Toggle
              checked={alertDraft.lowStockAlerts}
              onChange={(v) => updateAlert('lowStockAlerts', v)}
              label="Low stock alerts"
              description="Flag a medicine when a branch's quantity drops below its reorder level."
            />
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th style={{ width: '200px' }}>Low Stock Below (units)</th>
              </tr>
            </thead>
            <tbody>
              {MEDICINES.map((m) => (
                <tr key={m.id}>
                  <td className="fw-600">{m.name}</td>
                  <td>{m.category}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      aria-label={`Low stock level for ${m.name}`}
                      className={`input-field table-input ${alertErrors[`reorder-${m.id}`] ? 'error' : ''}`}
                      value={alertDraft.reorderLevels[m.id]}
                      onChange={(e) => updateReorderLevel(m.id, e.target.value)}
                      disabled={!alertDraft.lowStockAlerts}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingTax && (
        <TaxRateModal rate={editingTax} onClose={() => setEditingTax(null)} onSave={saveTax} />
      )}

      {editingExpense && (
        <ExpenseCategoryModal
          category={editingExpense}
          categories={settings.expenseCategories}
          currency={settings.currency}
          onClose={() => setEditingExpense(null)}
          onSave={saveExpense}
        />
      )}
    </div>
  )
}

const NOTIFICATION_TYPES = {
  'low-stock': { label: 'Low Stock', icon: AlertTriangle, tone: 'warning' },
  expiring: { label: 'Expiring', icon: Clock, tone: 'danger' },
  tax: { label: 'Government Tax', icon: Landmark, tone: 'teal' }
}

function NotificationsPanel({ notifications, readIds, scopeLabel, onToggleRead, onMarkAllRead, onDismiss, onRestoreDismissed, dismissedCount, onOpen }) {
  const [filter, setFilter] = useState('all')
  const isRead = (n) => readIds.includes(n.id)
  const unreadCount = notifications.filter((n) => !isRead(n)).length

  const filters = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    ...Object.entries(NOTIFICATION_TYPES).map(([key, t]) => ({ key, label: t.label, count: notifications.filter((n) => n.type === key).length }))
  ]

  const visible = notifications.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !isRead(n) : n.type === filter))

  return (
    <div className="content-section-card">
      <div className="section-header">
        <div>
          <h2 className="page-title">Notifications · {scopeLabel}</h2>
          <p className="page-desc">Stock alerts and government tax reminders that need your attention.</p>
        </div>
        <button type="button" className="secondary-action-btn" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={16} /> Mark all as read
        </button>
      </div>

      <div className="view-toggle notification-filters" role="tablist" aria-label="Filter notifications">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      <ul className="notification-list">
        {visible.map((n) => {
          const type = NOTIFICATION_TYPES[n.type]
          const Icon = type.icon
          const read = isRead(n)
          return (
            <li key={n.id} className={`notification-item ${read ? 'read' : 'unread'}`}>
              <div className={`stat-icon-wrapper ${type.tone}`}>
                <Icon size={18} />
              </div>

              <div className="notification-body">
                <div className="notification-title-row">
                  {!read && <span className="unread-dot" aria-label="Unread" />}
                  <span className="notification-title">{n.title}</span>
                </div>
                <p className="notification-message">{n.message}</p>
                <div className="notification-meta">
                  {n.branch ? <BranchTag branch={n.branch} /> : <span className="branch-tag"><Building2 size={12} /> All Branches</span>}
                  <span>{n.meta}</span>
                </div>
              </div>

              <div className="notification-actions">
                <button type="button" className="link-btn" onClick={() => onOpen(n)}>
                  View <ArrowRight size={14} />
                </button>
                <button type="button" className="icon-btn" onClick={() => onToggleRead(n.id)} title={read ? 'Mark as unread' : 'Mark as read'} aria-label={read ? 'Mark as unread' : 'Mark as read'}>
                  {read ? <Mail size={15} /> : <MailOpen size={15} />}
                </button>
                <button type="button" className="icon-danger-btn" onClick={() => onDismiss(n.id)} title="Dismiss" aria-label="Dismiss">
                  <X size={15} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="notification-empty">
          <CheckCircle2 size={28} />
          <span>{filter === 'unread' ? "You're all caught up." : 'No notifications here.'}</span>
        </div>
      )}

      {dismissedCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="link-btn" onClick={onRestoreDismissed}>
            Show {dismissedCount} dismissed {dismissedCount === 1 ? 'notification' : 'notifications'}
          </button>
        </div>
      )}
    </div>
  )
}

// TanStack Table features shared by the Inventory and Branches tables (module-level so they stay stable)
const listTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
  sortFns: { text: sortFn_text, basic: sortFn_basic }
})


const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Expiring Soon']

const INVENTORY_SORTS = {
  'name-asc': { label: 'Name (A–Z)', sorting: [{ id: 'name', desc: false }] },
  'name-desc': { label: 'Name (Z–A)', sorting: [{ id: 'name', desc: true }] },
  'stock-asc': { label: 'Stock (low to high)', sorting: [{ id: 'stock', desc: false }] },
  'stock-desc': { label: 'Stock (high to low)', sorting: [{ id: 'stock', desc: true }] },
  'expiry-asc': { label: 'Expiry (soonest first)', sorting: [{ id: 'expiry', desc: false }] },
  'price-desc': { label: 'Selling price (high to low)', sorting: [{ id: 'sellingPrice', desc: true }] }
}


const INVENTORY_DEFAULT_SORTING = INVENTORY_SORTS['name-asc'].sorting

// Search matches the medicine name, SKU code, or batch number
const inventorySearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, batch } = row.original
  return [name, id, batch].some((field) => field.toLowerCase().includes(query))
}

function InventoryTable({ data, branches, categories, showBranch, formatMoney }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState(INVENTORY_DEFAULT_SORTING)

  const columns = useMemo(() => {
    const branchName = (id) => branches.find((b) => b.id === id)?.name || ''
    return [
      { accessorKey: 'name', header: 'Product Name', sortFn: 'text', cell: (info) => <span className="fw-600">{info.getValue()}</span> },
      ...(showBranch
        ? [{
            accessorKey: 'branchId',
            header: 'Branch',
            filterFn: 'equalsString',
            sortFn: (a, b) => branchName(a.original.branchId).localeCompare(branchName(b.original.branchId)),
            cell: (info) => <BranchTag branch={branches.find((b) => b.id === info.getValue())} />
          }]
        : []),
      { accessorKey: 'category', header: 'Category', filterFn: 'equalsString', sortFn: 'text' },
      { accessorKey: 'stock', header: 'Current Stock', sortFn: 'basic', cell: (info) => `${info.getValue()} units` },
      { accessorKey: 'purchasePrice', header: 'Purchase Price', sortFn: 'basic', cell: (info) => formatMoney(info.getValue()) },
      { accessorKey: 'sellingPrice', header: 'Sells Price', sortFn: 'basic', sortUndefined: 'last', cell: (info) => (info.getValue() == null ? <span className="not-set">Not set</span> : formatMoney(info.getValue())) },
      { accessorKey: 'batch', header: 'Batch Number', sortFn: 'text', cell: (info) => <span className="batch-badge">{info.getValue()}</span> },
      { accessorKey: 'expiry', header: 'Expiration Date', sortFn: 'text' },
      { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> }
    ]
  }, [branches, showBranch, formatMoney])

  // The branch filter only applies while the Branch column is shown
  const activeColumnFilters = showBranch ? columnFilters : columnFilters.filter((f) => f.id !== 'branchId')

  const table = useTable({
    features: listTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters: activeColumnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: inventorySearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const filterValue = (id) => activeColumnFilters.find((f) => f.id === id)?.value ?? 'all'
  const setFilter = (id, value) => {
    table.getColumn(id)?.setFilterValue(value === 'all' ? undefined : value)
  }

  const sortKey = Object.keys(INVENTORY_SORTS).find((key) => JSON.stringify(INVENTORY_SORTS[key].sorting) === JSON.stringify(sorting)) ?? (sorting.length ? 'custom' : 'none')
  const filtersActive = Boolean(globalFilter) || activeColumnFilters.length > 0 || sortKey !== 'name-asc'

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting(INVENTORY_DEFAULT_SORTING)
  }

  const matchingCount = table.getFilteredRowModel().rows.length
  const visibleColumnCount = columns.length + 1

  return (
    <>
      {/* Search & Filters */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by name, SKU, or batch..."
            aria-label="Search inventory"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
            }}
          />
        </div>

        <select className="input-field filter-select" aria-label="Filter by category" value={filterValue('category')} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select className="input-field filter-select" aria-label="Filter by status" value={filterValue('status')} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="all">All Statuses</option>
          {INVENTORY_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        {showBranch && (
          <select className="input-field filter-select" aria-label="Filter by branch" value={filterValue('branchId')} onChange={(e) => setFilter('branchId', e.target.value)}>
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{matchingCount}</strong> of {data.length} items match
        </span>
        {filtersActive && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                <th>No</th>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th key={header.id} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button type="button" className="sort-header-btn" onClick={header.column.getToggleSortingHandler()}>
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} className="sort-idle" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {matchingCount === 0 && (
              <tr>
                <td colSpan={visibleColumnCount} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No medicines match your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  )
}

const BRANCH_STATUSES = ['Active', 'Inactive']

// Search matches the branch name, ID, or location
const branchSearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, location } = row.original
  return [name, id, location].some((field) => String(field).toLowerCase().includes(query))
}

function BranchesTable({ data, selectedBranch, onEdit, onToggleStatus, onDelete }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState([])

  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Branch Name',
      sortFn: 'text',
      cell: (info) => (
        <span className="fw-600">
          {info.getValue()}
          {info.row.original.id === selectedBranch && <span className="current-chip">Viewing</span>}
        </span>
      )
    },
    { accessorKey: 'location', header: 'Location', sortFn: 'text' },
    { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const b = info.row.original
        const isActive = b.status === 'Active'
        return (
          <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="icon-btn" onClick={() => onEdit(b)} aria-label={`Edit ${b.name}`} title="Edit">
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className={`icon-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}`}
              onClick={() => onToggleStatus(b)}
              aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${b.name}`}
              title={isActive ? 'Deactivate' : 'Activate'}
            >
              <Power size={15} />
            </button>
            <button type="button" className="icon-danger-btn" onClick={() => onDelete(b)} aria-label={`Delete ${b.name}`} title="Delete">
              <Trash2 size={15} />
            </button>
          </div>
        )
      }
    }
  ], [selectedBranch, onEdit, onToggleStatus, onDelete])

  const table = useTable({
    features: listTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    globalFilterFn: branchSearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const statusFilter = columnFilters.find((f) => f.id === 'status')?.value ?? 'all'
  const filtersActive = Boolean(globalFilter) || columnFilters.length > 0 || sorting.length > 0
  const matchingCount = table.getFilteredRowModel().rows.length

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting([])
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search by name or location..."
            aria-label="Search branches"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <select
          className="input-field filter-select"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => table.getColumn('status')?.setFilterValue(e.target.value === 'all' ? undefined : e.target.value)}
        >
          <option value="all">All Statuses</option>
          {BRANCH_STATUSES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{matchingCount}</strong> of {data.length} branches match
        </span>
        {filtersActive && (
          <button type="button" className="link-btn" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                <th>No</th>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th key={header.id} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button type="button" className="sort-header-btn" onClick={header.column.getToggleSortingHandler()}>
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} className="sort-idle" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {matchingCount === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No branches match your search or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

// Chart colors: validated dark-surface palette (slot 1 blue, slot 2 orange) + recessive chrome
const CHART_COLORS = {
  series1: '#3987e5',
  series2: '#d95926',
  deEmphasis: '#475569',
  grid: '#1f2937',
  axis: '#64748b',
  surface: '#111827'
}

const shortDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Round axis ticks (0 / 500 / 1,000 ...) that always include zero
const niceTicks = (values, count = 4) => {
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const raw = (max - min) / count || 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((st) => st >= raw)
  const ticks = []
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + step / 2; t += step) ticks.push(Math.round(t * 100) / 100)
  return ticks
}

const compactNumber = (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : String(Math.round(value)))

// One tooltip for every chart: the value leads, the series name follows, keyed with a short line
function ChartTooltip({ active, payload, label, formatValue, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tooltip-row">
          <span className="chart-tooltip-key" style={{ background: p.color || p.payload?.fill }} />
          <strong>{formatValue(p.value, p.dataKey)}</strong>
          <span>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, legend, table, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
        {legend && (
          <div className="chart-legend">
            {legend.map((l) => (
              <span key={l.label}>
                <span className={`chart-legend-key ${l.shape || 'line'}`} style={{ background: l.color }} /> {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="chart-body">{children}</div>
      {table && (
        <details className="chart-table">
          <summary>View data</summary>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

const axisProps = {
  stroke: CHART_COLORS.grid,
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_COLORS.grid }
}

function DashboardCharts({ branchId, branches, formatMoney, currencySymbol }) {
  const inBranch = (id) => branchId === 'all' || id === branchId
  const money = (v) => formatMoney(v)
  const axisMoney = (v) => `${v < 0 ? '-' : ''}${currencySymbol}${compactNumber(Math.abs(v))}`

  // Daily totals for the selected branch (or the whole network)
  const dates = [...new Set(DAILY_PERFORMANCE.map((r) => r.date))].sort()
  const daily = dates.map((date) => {
    const rows = DAILY_PERFORMANCE.filter((r) => r.date === date && inBranch(r.branchId))
    const sum = (field) => Math.round(rows.reduce((s, r) => s + r[field], 0) * 100) / 100
    const revenue = sum('revenue')
    const expenses = sum('expenses')
    return {
      date,
      transactions: sum('transactions'),
      revenue,
      expenses,
      purchases: sum('purchases'),
      profit: Math.round((revenue - sum('costOfGoods') - expenses) * 100) / 100
    }
  })
  const rangeLabel = `Daily · ${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`

  // Revenue per branch over the period; the selected branch is emphasised, the rest go gray
  const byBranch = branches
    .map((b) => ({
      id: b.id,
      name: b.name.replace(' Branch', '').replace(' (HQ)', ' HQ'),
      fullName: b.name,
      revenue: Math.round(DAILY_PERFORMANCE.filter((r) => r.branchId === b.id).reduce((s, r) => s + r.revenue, 0) * 100) / 100
    }))
    .filter((b) => b.revenue > 0)

  // Units sold per category for the selected scope, highest first
  const byCategory = CATEGORIES.map((category) => {
    const rows = CATEGORY_SALES.filter((r) => r.category === category && inBranch(r.branchId))
    return {
      category,
      unitsSold: rows.reduce((s, r) => s + r.unitsSold, 0),
      revenue: Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100
    }
  }).sort((a, b) => b.unitsSold - a.unitsSold)

  const ticksFor = (...fields) => {
    const ticks = niceTicks(daily.flatMap((d) => fields.map((f) => d[f])))
    return { ticks, domain: [ticks[0], ticks[ticks.length - 1]], interval: 0 }
  }
  const branchTicks = niceTicks(byBranch.map((b) => b.revenue))
  const categoryTicks = niceTicks(byCategory.map((c) => c.unitsSold))

  const timeTable = (field, label, format) => ({
    columns: ['Date', label],
    rows: daily.map((d) => [shortDate(d.date), format(d[field])])
  })

  const tooltip = (formatValue) => (
    <Tooltip
      cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
      content={<ChartTooltip formatValue={formatValue} labelFormatter={shortDate} />}
    />
  )

  const activeDot = (color) => ({ r: 4, fill: color, stroke: CHART_COLORS.surface, strokeWidth: 2 })

  return (
    <div className="chart-grid">
      <ChartCard title="Sales Over Time" subtitle={`Sale transactions · ${rangeLabel}`} table={timeTable('transactions', 'Transactions', (v) => v.toLocaleString())}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={compactNumber} width={48} {...axisProps} axisLine={false} {...ticksFor('transactions')} />
            {tooltip((v) => `${v.toLocaleString()} transactions`)}
            <Area type="monotone" dataKey="transactions" name="Sales" stroke={CHART_COLORS.series1} strokeWidth={2} fill={CHART_COLORS.series1} fillOpacity={0.1} activeDot={activeDot(CHART_COLORS.series1)} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Purchases Over Time" subtitle={`Stock purchased from suppliers · ${rangeLabel}`} table={timeTable('purchases', 'Purchases', money)}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('purchases')} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={money} labelFormatter={shortDate} />} />
            <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS.series1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Revenue & Expenses"
        subtitle={`Sales revenue vs operating expenses · ${rangeLabel}`}
        legend={[{ label: 'Revenue', color: CHART_COLORS.series1 }, { label: 'Expenses', color: CHART_COLORS.series2 }]}
        table={{ columns: ['Date', 'Revenue', 'Expenses'], rows: daily.map((d) => [shortDate(d.date), money(d.revenue), money(d.expenses)]) }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('revenue', 'expenses')} />
            {tooltip(money)}
            <Line type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.series1} strokeWidth={2} dot={false} activeDot={activeDot(CHART_COLORS.series1)} />
            <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CHART_COLORS.series2} strokeWidth={2} dot={false} activeDot={activeDot(CHART_COLORS.series2)} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Profit Over Time" subtitle={`Revenue − cost of goods − expenses · ${rangeLabel}`} table={timeTable('profit', 'Profit', money)}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('profit')} />
            <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeWidth={1} />
            {tooltip(money)}
            <Area type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS.series1} strokeWidth={2} fill={CHART_COLORS.series1} fillOpacity={0.1} activeDot={activeDot(CHART_COLORS.series1)} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Sales by Branch"
        subtitle={branchId === 'all' ? `Revenue per branch · ${rangeLabel.replace('Daily · ', '')}` : `Selected branch highlighted · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Branch', 'Revenue'], rows: byBranch.map((b) => [b.fullName, money(b.revenue)]) }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byBranch} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} ticks={branchTicks} domain={[0, branchTicks[branchTicks.length - 1]]} interval={0} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={money} labelFormatter={(name) => byBranch.find((b) => b.name === name)?.fullName || name} />} />
            <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {byBranch.map((b) => (
                <Cell key={b.id} fill={branchId === 'all' || b.id === branchId ? CHART_COLORS.series1 : CHART_COLORS.deEmphasis} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Top-Selling Categories"
        subtitle={`Units sold by category · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Category', 'Units Sold', 'Revenue'], rows: byCategory.map((c) => [c.category, c.unitsSold.toLocaleString(), money(c.revenue)]) }}
      >
        <ResponsiveContainer width="100%" height={Math.max(220, byCategory.length * 30)}>
          <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
            <XAxis type="number" tickFormatter={compactNumber} {...axisProps} ticks={categoryTicks} domain={[0, categoryTicks[categoryTicks.length - 1]]} interval={0} />
            <YAxis
              type="category"
              dataKey="category"
              width={165}
              {...axisProps}
              axisLine={false}
              interval={0}
              tick={({ x, y, payload }) => (
                <text x={x} y={y} dy={4} textAnchor="end" fill={CHART_COLORS.axis} fontSize={11}>{payload.value}</text>
              )}
            />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={(v) => `${v.toLocaleString()} units`} />} />
            <Bar dataKey="unitsSold" name="Units sold" fill={CHART_COLORS.series1} radius={[0, 4, 4, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ComingSoon({ feature, description }) {
  return (
    <div className="content-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary-cyan)', marginBottom: '1rem' }}>
        <Clock size={36} />
      </div>
      <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Coming Soon</h2>
      <p className="page-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
        The {feature} feature is currently under development. {description}
      </p>
    </div>
  )
}

export default function Dashboard({ userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [settings, setSettings] = useState(loadSettings)
  const [selectedBranch] = useState(() =>
    INITIAL_BRANCHES.some((b) => b.id === settings.defaultBranch) ? settings.defaultBranch : 'all'
  )
  const [branches, setBranches] = useState(INITIAL_BRANCHES)
  const [dashboardBranch, setDashboardBranch] = useState('all')
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [branchNotice, setBranchNotice] = useState(null)
  const [editingBranch, setEditingBranch] = useState(null)

  const branchById = (id) => branches.find((b) => b.id === id)
  const formatMoney = (value) => formatMoneyIn(settings.currency, value)
  const [sales, setSales] = useState(SALES)
  const [stockLevels, setStockLevels] = useState(BRANCH_STOCK)
  const [products, setProducts] = useState(MEDICINES)
  const [categories, setCategories] = useState(CATEGORIES)
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [inventoryNotice, setInventoryNotice] = useState(null)
  const [showNewSale, setShowNewSale] = useState(false)
  const [transfers, setTransfers] = useState(TRANSFERS)
  const [purchases, setPurchases] = useState(PURCHASES)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [purchaseNotice, setPurchaseNotice] = useState(null)
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [transferNotice, setTransferNotice] = useState(null)
  const [saleNotice, setSaleNotice] = useState(null)
  const inventory = buildInventory(settings, stockLevels, products)
  const [notificationState, setNotificationState] = useState(loadNotificationState)

  const handleSaveSettings = (next) => {
    setSettings(next)
    persistSettings(next)
  }

  const handleAddBranch = (data) => {
    const nextNumber = Math.max(0, ...branches.map((b) => Number(b.id.split('-')[1]))) + 1
    const newBranch = { ...data, id: `BR-${String(nextNumber).padStart(2, '0')}`, revenue: 0, expenses: 0 }
    setBranches((prev) => [...prev, newBranch])
    setShowAddBranch(false)
    setBranchNotice({ type: 'success', text: `${newBranch.name} (${newBranch.id}) was added successfully.` })
  }

  const handleEditBranch = (data) => {
    setBranches((prev) => prev.map((b) => (b.id === editingBranch.id ? { ...b, ...data } : b)))
    setEditingBranch(null)
    setBranchNotice({ type: 'success', text: `${data.name} was updated.` })
  }

  const handleToggleBranchStatus = (branch) => {
    const status = branch.status === 'Active' ? 'Inactive' : 'Active'
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, status } : b)))
    setBranchNotice({
      type: 'success',
      text: status === 'Active'
        ? `${branch.name} is now Active and can record sales again.`
        : `${branch.name} is now Inactive. It can't be chosen when recording new sales.`
    })
  }

  // A branch with stock or history can't be deleted (its records would lose their branch); deactivate it instead
  const handleDeleteBranch = (branch) => {
    const hasRecords =
      stockLevels.some((e) => e.branchId === branch.id) ||
      sales.some((s) => s.branchId === branch.id) ||
      purchases.some((p) => p.branchId === branch.id) ||
      transfers.some((t) => t.from === branch.id || t.to === branch.id) ||
      EXPENSES.some((e) => e.branchId === branch.id) ||
      DAILY_PERFORMANCE.some((r) => r.branchId === branch.id)
    if (hasRecords) {
      setBranchNotice({ type: 'error', text: `${branch.name} can't be deleted because it has stock, sales, or other records. Deactivate it instead.` })
      return
    }
    if (!window.confirm(`Delete ${branch.name}? This cannot be undone.`)) return
    setBranches((prev) => prev.filter((b) => b.id !== branch.id))
    if (dashboardBranch === branch.id) setDashboardBranch('all')
    setBranchNotice({ type: 'success', text: `${branch.name} was deleted.` })
  }

  const isAllBranches = selectedBranch === 'all'
  const activeBranchCount = branches.filter((b) => b.status === 'Active').length
  const currentBranch = branchById(selectedBranch)
  const scopeLabel = isAllBranches ? 'All Branches' : currentBranch.name
  const inScope = (branchId) => isAllBranches || branchId === selectedBranch
  const query = searchQuery.toLowerCase()

  // Branch-scoped data
  const scopedInventory = inventory.filter((item) => inScope(item.branchId))
  const filteredInventory = scopedInventory.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.batch.toLowerCase().includes(query)
  )
  const scopedSales = sales.filter((s) => inScope(s.branchId))
  const scopedPurchases = purchases.filter((p) => inScope(p.branchId))
  const scopedPayments = PAYMENTS.filter((p) => inScope(p.branchId))
  const scopedTransfers = transfers.filter((t) => inScope(t.from) || inScope(t.to))

  // Dashboard figures follow the Dashboard's own branch filter (All Branches or one branch)
  const isDashboardAll = dashboardBranch === 'all'
  const dashboardBranchInfo = branchById(dashboardBranch)
  const dashboardScopeLabel = isDashboardAll ? 'All Branches' : dashboardBranchInfo?.name
  const inDashboard = (branchId) => isDashboardAll || branchId === dashboardBranch
  const dashboardInventory = inventory.filter((i) => inDashboard(i.branchId))
  const dashboardLowStock = dashboardInventory.filter((i) => i.status === 'Low Stock').length
  const dashboardExpiring = dashboardInventory.filter((i) => i.status === 'Expiring Soon').length

  const totalRevenue = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + b.revenue, 0)
  const totalExpenses = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + b.expenses, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0
  const lowStockCount = scopedInventory.filter((i) => i.status === 'Low Stock').length
  const expiringCount = scopedInventory.filter((i) => i.status === 'Expiring Soon').length
  const salesTotal = scopedSales.reduce((sum, s) => sum + s.total, 0)
  const salesUnitsSold = scopedSales.reduce((sum, s) => sum + s.qty, 0)
  const salesTodayList = scopedSales.filter((s) => s.date === toDateKey(new Date()))
  const salesTodayTotal = salesTodayList.reduce((sum, s) => sum + s.total, 0)
  const salesTodayUnits = salesTodayList.reduce((sum, s) => sum + s.qty, 0)

  // Today's figures for the Dashboard branch filter
  const todayKey = toDateKey(new Date())
  const todaySales = sales.filter((s) => inDashboard(s.branchId) && s.date === todayKey)
  const todayPurchases = purchases.filter((p) => inDashboard(p.branchId) && p.date === todayKey)
  const todayExpenses = EXPENSES.filter((e) => inDashboard(e.branchId) && e.date === todayKey)
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayUnitsSold = todaySales.reduce((sum, s) => sum + s.qty, 0)
  const todayCostOfGoods = todaySales.reduce((sum, s) => sum + (products.find((m) => m.name === s.product)?.purchasePrice || 0) * s.qty, 0)
  const todayPurchaseTotal = todayPurchases.reduce((sum, p) => sum + p.total, 0)
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0)
  const todayProfit = todayRevenue - todayCostOfGoods - todayExpenseTotal
  const unitsTransferred = scopedTransfers.reduce((sum, t) => sum + t.qty, 0)

  // Notifications are generated from current stock, transfers, and tax policy
  const allNotifications = [
    ...scopedInventory
      .filter((i) => i.status === 'Low Stock')
      .map((i) => ({
        id: `low-${i.key}-${i.stock}`,
        type: 'low-stock',
        tab: 'inventory',
        branch: branchById(i.branchId),
        title: `Low stock: ${i.name}`,
        message: `Only ${i.stock} units left, below the low stock level of ${i.reorderLevel} units. Reorder or request a transfer.`,
        meta: `Batch ${i.batch}`,
        sort: 1
      })),
    ...scopedInventory
      .filter((i) => i.status === 'Expiring Soon')
      .map((i) => {
        const days = daysUntil(new Date(i.expiry))
        return {
          id: `exp-${i.key}-${i.batch}`,
          type: 'expiring',
          tab: 'inventory',
          branch: branchById(i.branchId),
          title: `Expiring soon: ${i.name}`,
          message: `${i.stock} units in batch ${i.batch} ${days < 0 ? `expired ${-days} days ago` : days === 0 ? 'expire today' : `expire in ${days} ${days === 1 ? 'day' : 'days'}`}.`,
          meta: `Expires ${formatDate(new Date(i.expiry))}`,
          sort: 0
        }
      }),
    ...settings.tax.rates
      .filter((r) => r.status === 'Active')
      .map((r) => ({ rate: r, due: nextTaxDueDate(r) }))
      .filter(({ due }) => daysUntil(due) <= TAX_REMINDER_DAYS)
      .map(({ rate, due }) => {
        const days = daysUntil(due)
        return {
          id: `tax-${rate.id}-${due.getFullYear()}`,
          type: 'tax',
          tab: 'policy',
          branch: null,
          title: `${rate.name} due ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}`,
          message: `The yearly ${rate.name} (${Number(rate.rate)}%) must be paid to the government by ${formatDate(due)}.`,
          meta: `Due ${formatDate(due)}`,
          sort: 3
        }
      })
  ].sort((a, b) => a.sort - b.sort)

  const notifications = allNotifications.filter((n) => !notificationState.dismissed.includes(n.id))
  const unreadNotifications = notifications.filter((n) => !notificationState.read.includes(n.id)).length
  const dismissedCount = allNotifications.length - notifications.length

  const updateNotificationState = (updater) => {
    setNotificationState((prev) => {
      const next = updater(prev)
      persistNotificationState(next)
      return next
    })
  }

  const toggleNotificationRead = (id) =>
    updateNotificationState((prev) => ({
      ...prev,
      read: prev.read.includes(id) ? prev.read.filter((r) => r !== id) : [...prev.read, id]
    }))

  const markAllNotificationsRead = () =>
    updateNotificationState((prev) => ({ ...prev, read: [...new Set([...prev.read, ...notifications.map((n) => n.id)])] }))

  const dismissNotification = (id) =>
    updateNotificationState((prev) => ({ ...prev, dismissed: [...prev.dismissed, id] }))

  const restoreDismissedNotifications = () =>
    updateNotificationState((prev) => ({ ...prev, dismissed: prev.dismissed.filter((id) => !allNotifications.some((n) => n.id === id)) }))

  const openNotification = (n) => {
    updateNotificationState((prev) => (prev.read.includes(n.id) ? prev : { ...prev, read: [...prev.read, n.id] }))
    setActiveTab(n.tab)
  }

  const branchSummary = (branchId) => {
    const items = inventory.filter((i) => i.branchId === branchId)
    return {
      units: items.reduce((sum, i) => sum + i.stock, 0),
      alerts: items.filter((i) => i.status !== 'In Stock').length
    }
  }

  // Records a sale at the chosen branch and takes the quantity out of that branch's stock
  const handleRecordSale = ({ medId, ...data }) => {
    const nextNumber = Math.max(0, ...sales.map((s) => Number(String(s.id).split('-')[1]) || 0)) + 1
    const sale = { id: `SL-${nextNumber}`, ...data, date: toDateKey(new Date()) }
    setSales((prev) => [sale, ...prev])
    setStockLevels((prev) => prev.map((e) => (e.medId === medId && e.branchId === data.branchId ? { ...e, stock: e.stock - data.qty } : e)))
    setShowNewSale(false)
    setSaleNotice(`Sale ${sale.id} recorded at ${branchById(data.branchId)?.name}: ${data.qty} × ${data.product} for ${formatMoney(data.total)}.`)
  }

  // Single-user system: a transfer completes immediately and moves the stock between the two branches
  const handleRequestTransfer = ({ medId, expiry, ...data }) => {
    const nextNumber = Math.max(0, ...transfers.map((t) => Number(String(t.id).split('-')[1]) || 0)) + 1
    const transfer = { id: `TRF-${nextNumber}`, ...data, date: toDateKey(new Date()), status: 'Completed' }
    setTransfers((prev) => [transfer, ...prev])
    setStockLevels((prev) => {
      const moved = prev.map((e) => {
        if (e.medId === medId && e.branchId === data.from) return { ...e, stock: e.stock - data.qty }
        if (e.medId === medId && e.branchId === data.to) return { ...e, stock: e.stock + data.qty }
        return e
      })
      const destinationHasProduct = prev.some((e) => e.medId === medId && e.branchId === data.to)
      return destinationHasProduct ? moved : [...moved, { medId, branchId: data.to, stock: data.qty, batch: data.batch, expiry }]
    })
    setShowNewTransfer(false)
    setTransferNotice(`Transfer ${transfer.id} completed: ${data.qty} × ${data.product} moved from ${branchById(data.from)?.name} to ${branchById(data.to)?.name}.`)
  }

  // Records a purchase and adds the bought quantity to the receiving branch's stock
  const handleCreatePurchase = ({ medId: knownMedId, purchasePrice, ...data }) => {
    const nextNumber = Math.max(0, ...purchases.map((p) => Number(String(p.id).split('-')[1]) || 0)) + 1
    const purchase = { id: `PO-${nextNumber}`, ...data, date: toDateKey(new Date()), status: 'Paid' }
    let medId = knownMedId
    if (!categories.includes(data.category)) setCategories((prev) => [...prev, data.category])
    if (!medId) {
      // A product typed into the purchase joins the catalog; its selling price is set later in Inventory → Add Medicine
      const nextMed = Math.max(0, ...products.map((m) => Number(String(m.id).split('-')[1]) || 0)) + 1
      medId = `MED-${nextMed}`
      setProducts((prev) => [...prev, { id: medId, name: data.product, category: data.category, purchasePrice, sellingPrice: null, reorderLevel: 10 }])
    }
    setPurchases((prev) => [purchase, ...prev])
    setStockLevels((prev) => {
      const exists = prev.some((e) => e.medId === medId && e.branchId === data.branchId)
      if (exists) return prev.map((e) => (e.medId === medId && e.branchId === data.branchId ? { ...e, stock: e.stock + data.qty } : e))
      // A product new to this branch gets the purchase ID as its batch and a default two-year expiry
      const expiry = new Date()
      expiry.setFullYear(expiry.getFullYear() + 2)
      return [...prev, { medId, branchId: data.branchId, stock: data.qty, batch: purchase.id, expiry: toDateKey(expiry) }]
    })
    setShowNewPurchase(false)
    setPurchaseNotice(`Purchase ${purchase.id} created: ${data.qty} × ${data.product} from ${data.supplier} received into ${branchById(data.branchId)?.name} for ${formatMoney(data.total)}.${knownMedId ? '' : ' New product added to Inventory: set its selling price with Add Medicine.'}`)
  }

  const handleSaveMedicine = ({ medId, name, sellingPrice }) => {
    setProducts((prev) => prev.map((m) => (m.id === medId ? { ...m, sellingPrice } : m)))
    setShowAddMedicine(false)
    setInventoryNotice(`${name} is ready for sale at ${formatMoney(sellingPrice)} per unit.`)
  }

  const openBranch = (branchId) => {
    setDashboardBranch(branchId)
    setActiveTab('overview')
  }

  const navItem = (tab, Icon, label, badge) => (
    <button
      className={`nav-item ${activeTab === tab ? 'active' : ''}`}
      onClick={() => setActiveTab(tab)}
    >
      <Icon size={18} />
      <span>{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  )

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon-wrapper">
            <Pill size={22} />
          </div>
          <div className="brand-title-wrap">
            <span className="logo-text">{settings.pharmacyName}</span>
            <span className="brand-subtitle">Multi-Branch Inventory</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">MAIN MENU</div>
          {navItem('overview', LayoutDashboard, 'Dashboard')}
          {navItem('inventory', Package, 'Inventory', lowStockCount + expiringCount)}
          {navItem('sales', ShoppingCart, 'Sales')}
          {navItem('notifications', Bell, 'Notifications', unreadNotifications)}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>OPERATIONS</div>
          {navItem('orders', PackageCheck, 'Purchase')}
          {navItem('transfers', ArrowLeftRight, 'Stock Transfers')}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>ANALYTICS & AUDIT</div>
          {navItem('reports', BarChart3, 'Reports')}
          {navItem('audit', FileText, 'Audit logs')}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>CONFIGURATION</div>
          {navItem('branches', Building2, 'Branches', branches.length)}
          {navItem('policy', ShieldCheck, 'Policy')}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">Pharmacist</span>
              <span className="user-email">{userEmail || 'pharmacist@pharmacare.io'}</span>
            </div>
          </div>

          <button type="button" className="logout-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Header Bar */}
        <header className="dashboard-header"></header>

        {/* Dynamic Views */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <>
              {/* Branch Filter: scopes every figure and chart on the Dashboard */}
              <p className="dashboard-filter-hint">
                Select a branch to view its dashboard, or choose All Branches to see the whole network.
              </p>
              <div className="dashboard-filter-row">
                <label className="dashboard-filter">
                  <Building2 size={16} />
                  <span>Branch</span>
                  <select className="input-field" value={dashboardBranch} onChange={(e) => setDashboardBranch(e.target.value)} aria-label="Dashboard branch filter">
                    <option value="all">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Today's Figures */}
              <div className="section-label">
                <Clock size={14} /> Today · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} · {dashboardScopeLabel}
              </div>
              <div className="stats-grid today-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Sales</span>
                    <div className="stat-icon-wrapper cyan">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{todaySales.length}</div>
                  <div className="stat-chip neutral">
                    {todaySales.length === 1 ? 'transaction' : 'transactions'} · {todayUnitsSold} units sold
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Purchases</span>
                    <div className="stat-icon-wrapper teal">
                      <PackageCheck size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(todayPurchaseTotal)}</div>
                  <div className="stat-chip neutral">
                    {todayPurchases.length} {todayPurchases.length === 1 ? 'purchase order' : 'purchase orders'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Expenses</span>
                    <div className="stat-icon-wrapper danger">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(todayExpenseTotal)}</div>
                  <div className="stat-chip negative">
                    {todayExpenses.length} {todayExpenses.length === 1 ? 'expense' : 'expenses'} recorded
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(todayRevenue)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> From {todaySales.length} {todaySales.length === 1 ? 'sale' : 'sales'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Profit</span>
                    <div className={`stat-icon-wrapper ${todayProfit < 0 ? 'danger' : 'teal'}`}>
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: todayProfit < 0 ? '#fb7185' : '#34d399' }}>{formatMoney(todayProfit)}</div>
                  <div className={`stat-chip ${todayProfit < 0 ? 'negative' : 'positive'}`} title="Revenue − cost of goods sold − expenses">
                    Revenue − cost of goods − expenses
                  </div>
                </div>
              </div>

              <div className="section-label" style={{ marginTop: '1.75rem' }}>
                <BarChart3 size={14} /> Overall · {dashboardScopeLabel}
              </div>

              {/* Metric Stat Cards: Branches, Financials (Revenue, Expense, Profit) + Stock Status */}
              <div className="stats-grid today-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Branches</span>
                    <div className="stat-icon-wrapper cyan">
                      <Building2 size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{branches.length}</div>
                  <div className="stat-chip positive">
                    <CheckCircle2 size={12} /> {activeBranchCount} active{branches.length - activeBranchCount ? ` · ${branches.length - activeBranchCount} inactive` : ''}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(totalRevenue)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> {dashboardScopeLabel}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Expenses</span>
                    <div className="stat-icon-wrapper danger">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(totalExpenses)}</div>
                  <div className="stat-chip negative">
                    Stock Intake & Operations
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Net Profit</span>
                    <div className="stat-icon-wrapper teal">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#34d399' }}>{formatMoney(netProfit)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> {profitMargin.toFixed(1)}% Profit Margin
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Stock Alerts</span>
                    <div className="stat-icon-wrapper warning">
                      <AlertTriangle size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{dashboardLowStock + dashboardExpiring} Items</div>
                  <div className="stat-chip negative">
                    {dashboardLowStock} low · {dashboardExpiring} expiring
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="section-label" style={{ marginTop: '1.75rem' }}>
                <TrendingUp size={14} /> Trends · {dashboardScopeLabel}
              </div>
              <DashboardCharts
                branchId={dashboardBranch}
                branches={branches}
                formatMoney={formatMoney}
                currencySymbol={(CURRENCIES[settings.currency]?.symbol || '$').trim()}
              />

              {/* Branch Performance Comparison (network view only) */}
              {isDashboardAll && (
                <div className="content-section-card" style={{ marginTop: '1.5rem' }}>
                  <div className="section-header">
                    <h3>Branch Performance</h3>
                    <button className="link-btn" onClick={() => setActiveTab('branches')}>
                      Manage Branches <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Branch</th>
                          <th>Revenue</th>
                          <th>Expenses</th>
                          <th>Net Profit</th>
                          <th>Units in Stock</th>
                          <th>Stock Alerts</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((b) => {
                          const summary = branchSummary(b.id)
                          return (
                            <tr key={b.id}>
                              <td className="fw-600">{b.name}</td>
                              <td>{formatMoney(b.revenue)}</td>
                              <td>{formatMoney(b.expenses)}</td>
                              <td className="fw-600" style={{ color: '#34d399' }}>{formatMoney(b.revenue - b.expenses)}</td>
                              <td>{summary.units.toLocaleString()} units</td>
                              <td>
                                <StatusTag status={summary.alerts ? 'Low Stock' : 'In Stock'} />
                                {summary.alerts ? <span style={{ marginLeft: '0.4rem' }}>{summary.alerts}</span> : null}
                              </td>
                              <td>
                                <button className="link-btn" onClick={() => openBranch(b.id)}>
                                  Open <ArrowRight size={14} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'inventory' && (
            <div className="content-section-card">
              <div className="section-header">
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <h2 className="page-title" style={{ textAlign: 'center' }}>Medicine Inventory · {scopeLabel}</h2>
                  {!isAllBranches && (
                    <p className="page-desc" style={{ textAlign: 'center' }}>
                      Current pharmaceutical products and quantities held at {currentBranch.name}.
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button className="primary-action-btn" onClick={() => setShowAddMedicine(true)}>
                    <Plus size={16} /> Add Medicine
                  </button>
                </div>
              </div>

              {inventoryNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{inventoryNotice}</span>
                  <button type="button" onClick={() => setInventoryNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <InventoryTable
                data={filteredInventory}
                branches={branches}
                categories={categories}
                showBranch={isAllBranches}
                formatMoney={formatMoney}
              />
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Sales History · {scopeLabel}</h2>
                  <p className="page-desc">Record of pharmacy sales transactions, receipts, and customer purchase logs per branch.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowNewSale(true)}>
                  <Plus size={16} /> New Sale Transaction
                </button>
              </div>

              {saleNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{saleNotice}</span>
                  <button type="button" onClick={() => setSaleNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Sales Stat Cards */}
              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Sales</span>
                    <div className="stat-icon-wrapper teal">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(salesTotal)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> {scopeLabel}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Sales</span>
                    <div className="stat-icon-wrapper cyan">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(salesTodayTotal)}</div>
                  <div className="stat-chip neutral">
                    <Clock size={12} /> {salesTodayList.length} {salesTodayList.length === 1 ? 'transaction' : 'transactions'} today
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Quantity Sold</span>
                    <div className="stat-icon-wrapper warning">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{salesUnitsSold.toLocaleString()}</div>
                  <div className="stat-chip neutral">
                    {salesTodayUnits.toLocaleString()} {salesTodayUnits === 1 ? 'unit' : 'units'} today
                  </div>
                </div>
              </div>

              {/* Sales History Table */}
              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer / Prescription</th>
                      {isAllBranches && <th>Branch</th>}
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Items Purchased</th>
                      <th>Total Amount</th>
                      <th>Date Sold</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="fw-600">{sale.customer}</td>
                        {isAllBranches && <td><BranchTag branch={branchById(sale.branchId)} /></td>}
                        <td>{sale.category}</td>
                        <td className="fw-600">{sale.product}</td>
                        <td>{sale.qty} {sale.qty === 1 ? 'unit' : 'units'}</td>
                        <td className="fw-600">{formatMoney(sale.total)}</td>
                        <td>{sale.date}</td>
                        <td><StatusTag status={sale.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Purchase · {scopeLabel}</h2>
                  <p className="page-desc">Generate purchase orders to distributors and receive incoming stock into a specific branch.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowNewPurchase(true)}>
                  <Plus size={16} /> Create Purchase
                </button>
              </div>

              {purchaseNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{purchaseNotice}</span>
                  <button type="button" onClick={() => setPurchaseNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      {isAllBranches && <th>Receiving Branch</th>}
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Quantity</th>
                      <th>Total Cost</th>
                      <th>Purchased On</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedPurchases.map((po) => (
                      <tr key={po.id}>
                        <td className="fw-600">{po.supplier}</td>
                        {isAllBranches && <td><BranchTag branch={branchById(po.branchId)} /></td>}
                        <td>{po.category}</td>
                        <td className="fw-600">{po.product}</td>
                        <td>{po.qty.toLocaleString()} units</td>
                        <td className="fw-600">{formatMoney(po.total)}</td>
                        <td>{po.date}</td>
                        <td><StatusTag status={po.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Purchase Payment & Transaction History Section */}
              <div style={{ marginTop: '2.5rem' }}>
                <div className="section-header">
                  <div>
                    <h3>Payment & Transaction History</h3>
                    <p className="page-desc">Supplier settlement history and payment transaction records.</p>
                  </div>
                </div>

                <div className="table-responsive" style={{ marginTop: '1rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Transaction Ref</th>
                        {isAllBranches && <th>Branch</th>}
                        <th>Supplier</th>
                        <th>Payment Method</th>
                        <th>Amount Paid</th>
                        <th>Transaction Date</th>
                        <th>Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedPayments.map((txn) => (
                        <tr key={txn.id}>
                          <td className="font-mono">{txn.id}</td>
                          {isAllBranches && <td><BranchTag branch={branchById(txn.branchId)} /></td>}
                          <td className="fw-600">{txn.supplier}</td>
                          <td><span className="batch-badge">{txn.method}</span></td>
                          <td className="fw-600">{formatMoney(txn.amount)}</td>
                          <td>{txn.date}</td>
                          <td><StatusTag status={txn.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Stock Transfers · {scopeLabel}</h2>
                  <p className="page-desc">Move stock between branches to cover shortages and rebalance expiring batches.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowNewTransfer(true)}>
                  <Plus size={16} /> New Transfer
                </button>
              </div>

              {transferNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{transferNotice}</span>
                  <button type="button" onClick={() => setTransferNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Transfers</span>
                    <div className="stat-icon-wrapper cyan">
                      <ArrowLeftRight size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedTransfers.length}</div>
                  <div className="stat-chip positive"><CheckCircle2 size={12} /> All completed</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Quantity Transferred</span>
                    <div className="stat-icon-wrapper teal">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{unitsTransferred.toLocaleString()}</div>
                  <div className="stat-chip neutral">Moved between branches</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Transfer ID</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Product Name</th>
                      <th>Batch</th>
                      <th>Quantity</th>
                      <th>Requested By</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedTransfers.map((trf) => (
                      <tr key={trf.id}>
                        <td className="font-mono">{trf.id}</td>
                        <td><BranchTag branch={branchById(trf.from)} /></td>
                        <td><BranchTag branch={branchById(trf.to)} /></td>
                        <td className="fw-600">{trf.product}</td>
                        <td><span className="batch-badge">{trf.batch}</span></td>
                        <td>{trf.qty} units</td>
                        <td>{trf.requestedBy}</td>
                        <td>{trf.date}</td>
                        <td><StatusTag status={trf.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Branches</h2>
                  <p className="page-desc">Manage pharmacy locations across the network: edit details, activate or deactivate, and delete branches.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowAddBranch(true)}>
                  <Plus size={16} /> Add Branch
                </button>
              </div>

              {branchNotice && (
                <div className={`success-notice ${branchNotice.type}`}>
                  {branchNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{branchNotice.text}</span>
                  <button type="button" onClick={() => setBranchNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <BranchesTable
                data={branches}
                selectedBranch={selectedBranch}
                onEdit={setEditingBranch}
                onToggleStatus={handleToggleBranchStatus}
                onDelete={handleDeleteBranch}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <ComingSoon
              feature="Reports & Analytics"
              description="Branch-level and consolidated financial reporting and analytical exports will be available in the upcoming release."
            />
          )}

          {activeTab === 'audit' && (
            <ComingSoon
              feature="Audit logs"
              description="Real-time activity tracking and compliance logging for every branch will be available in the upcoming release."
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsPanel
              notifications={notifications}
              readIds={notificationState.read}
              scopeLabel={scopeLabel}
              dismissedCount={dismissedCount}
              onToggleRead={toggleNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onDismiss={dismissNotification}
              onRestoreDismissed={restoreDismissedNotifications}
              onOpen={openNotification}
            />
          )}

          {activeTab === 'policy' && (
            <div className="content-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                <ShieldCheck size={36} />
              </div>
              <h2 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No Policy Data</h2>
              <p className="page-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
                No policies or rule configurations exist at this time.
              </p>
            </div>
          )}
        </div>
      </main>

      {showAddMedicine && (
        <AddMedicineModal
          products={products}
          categories={categories}
          formatMoney={formatMoney}
          onClose={() => setShowAddMedicine(false)}
          onSave={handleSaveMedicine}
        />
      )}

      {showNewPurchase && (
        <NewPurchaseModal
          branches={branches}
          inventory={inventory}
          products={products}
          categories={categories}
          suppliers={[...new Set(purchases.map((p) => p.supplier))].sort()}
          formatMoney={formatMoney}
          onClose={() => setShowNewPurchase(false)}
          onSave={handleCreatePurchase}
        />
      )}

      {showNewTransfer && (
        <NewTransferModal
          branches={branches}
          inventory={inventory}
          categories={categories}
          maxQty={settings.maxTransferQty}
          onClose={() => setShowNewTransfer(false)}
          onSave={handleRequestTransfer}
        />
      )}

      {showNewSale && (
        <NewSaleModal
          branches={branches}
          inventory={inventory}
          categories={categories}
          formatMoney={formatMoney}
          onClose={() => setShowNewSale(false)}
          onSave={handleRecordSale}
        />
      )}

      {editingBranch && (
        <BranchModal
          branch={editingBranch}
          branches={branches}
          onClose={() => setEditingBranch(null)}
          onSave={handleEditBranch}
        />
      )}

      {showAddBranch && (
        <BranchModal
          branches={branches}
          onClose={() => setShowAddBranch(false)}
          onSave={handleAddBranch}
        />
      )}
    </div>
  )
}
