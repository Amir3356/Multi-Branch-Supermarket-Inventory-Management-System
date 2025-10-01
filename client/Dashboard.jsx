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
  PackageX,
  Undo2,
  PackageMinus,
  Power,
  Sun,
  UserCog,
  UserPlus,
  UserCheck,
  Monitor,
  Moon,
  ShieldCheck,
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
import DAMAGED from './data/damaged.json'
import CUSTOMER_RETURNS from './data/customerReturns.json'
import SUPPLIER_RETURNS from './data/supplierReturns.json'
import AUDIT_LOGS from './data/auditLogs.json'
import ACCOUNTS from './data/accounts.json'
import SESSIONS from './data/sessions.json'
import GOVERNMENT_TAXES from './data/governmentTaxes.json'
import EXPENSE_CATEGORIES from './data/expenseCategories.json'
import CATEGORIES from './data/categories.json'
import EXPENSES from './data/expenses.json'
import DAILY_PERFORMANCE from './data/dailyPerformance.json'
import CATEGORY_SALES from './data/categorySales.json'

const STATUS_TONE = {
  'In Stock': 'in-stock',
  'Low Stock': 'low-stock',
  'Out of Stock': 'out-of-stock',
  'Paid': 'in-stock',
  'Cleared': 'in-stock',
  'Received': 'in-stock',
  'Active': 'in-stock',
  'Completed': 'in-stock',
  'Refunded': 'out-of-stock',
  'Partially Refunded': 'low-stock',
  'Restocked': 'in-stock',
  'Written Off': 'out-of-stock',
  'Idle': 'low-stock',
  'Ended': 'inactive',
  'Returned': 'out-of-stock',
  'Partially Returned': 'low-stock',
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
  // Starting minimum stock level for new products; every product's level applies to all branches
  defaultMinStock: 20,
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

// Dashboard date filter presets; weeks start on Monday
const DATE_PRESETS = { today: 'Today', week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom Date Range' }

const getPresetRange = (preset) => {
  const today = new Date()
  const todayKey = toDateKey(today)
  if (preset === 'week') {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return [toDateKey(monday), todayKey]
  }
  if (preset === 'month') return [`${todayKey.slice(0, 7)}-01`, todayKey]
  if (preset === 'quarter') {
    // Calendar quarters: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3 + 1
    return [`${todayKey.slice(0, 4)}-${String(quarterStartMonth).padStart(2, '0')}-01`, todayKey]
  }
  if (preset === 'year') return [`${todayKey.slice(0, 4)}-01-01`, todayKey]
  return [todayKey, todayKey]
}

const formatRangeLabel = (from, to) => {
  const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

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

const THEME_STORAGE_KEY = 'pharmacare-theme'

const loadTheme = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const persistTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable; the theme still applies for this session
  }
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

// Status reflects quantity only: In Stock, Low Stock (below the reorder level), or Out of Stock (none left)
const getStockStatus = (stock, reorderLevel, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (settings.lowStockAlerts && stock < reorderLevel) return 'Low Stock'
  return 'In Stock'
}

// Expiry is tracked separately so a batch can be both low and close to expiry
const isExpiringSoon = (expiry, settings) =>
  settings.expiryAlerts && (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24) <= settings.expiryWarningDays

// Inventory rows: one row per medicine per branch
const buildInventory = (settings, stockLevels, products) =>
  stockLevels.map((entry) => {
    const med = products.find((m) => m.id === entry.medId)
    const reorderLevel = settings.defaultMinStock
    return {
      ...med,
      ...entry,
      reorderLevel,
      key: `${entry.medId}-${entry.branchId}`,
      status: getStockStatus(entry.stock, reorderLevel, settings),
      expiringSoon: isExpiringSoon(entry.expiry, settings)
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
      qty
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
  const [form, setForm] = useState({ category: '', medId: '', purchasePrice: '', sellingPrice: '' })
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

const DAMAGE_REASONS = ['Broken / crushed packaging', 'Water damage', 'Contaminated', 'Temperature damage (cold chain)', 'Defective item', 'Other']

const EMPTY_DAMAGE_FORM = { branchId: '', category: '', key: '', qty: '', reason: '' }

// Records stock that was physically damaged and takes it out of the branch's sellable stock
function RecordDamageModal({ branches, inventory, categories, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_DAMAGE_FORM)
  const [errors, setErrors] = useState({})
  const activeBranches = branches.filter((b) => b.status === 'Active')

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

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
    const newErrors = {}
    if (!form.branchId) newErrors.branchId = 'Select the branch where the damage happened'
    if (!form.category) newErrors.category = form.branchId ? 'Select a category' : 'Select a branch first'
    if (!product) newErrors.key = form.category ? 'Select a product' : 'Select a category first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (product && qty > product.stock) newErrors.qty = `Only ${product.stock} units in stock at this branch`
    if (!form.reason) newErrors.reason = 'Select a reason'
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

  return (
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
    </div>
  )
}

const RETURN_REASONS = ['Wrong item', 'Adverse reaction', 'Expired or defective', 'Prescription changed', 'Changed mind', 'Other']

const RETURN_CONDITIONS = {
  Resellable: 'Unopened and fine: put back into the branch\'s stock',
  Damaged: 'Opened or faulty: write off as damaged'
}

const EMPTY_RETURN_FORM = { category: '', product: '', saleId: '', qty: '', reason: '', condition: '' }

// A customer brings back part or all of an earlier sale and is refunded at the sale's unit price
function CustomerReturnModal({ sales, returnedQty, branchById, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RETURN_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Only sales that still have units left to return, narrowed by category and product
  const returnable = sales.filter((s) => s.qty - returnedQty(s.id) > 0)
  const returnCategories = [...new Set(returnable.map((s) => s.category))].sort()
  const categoryProducts = [...new Set(returnable.filter((s) => s.category === form.category).map((s) => s.product))].sort()
  const productSales = returnable.filter((s) => s.category === form.category && s.product === form.product)
  const sale = productSales.find((s) => s.id === form.saleId)
  const remaining = sale ? sale.qty - returnedQty(sale.id) : 0
  const unitPrice = sale ? sale.total / sale.qty : 0
  const qty = Number(form.qty)
  const validQty = sale && Number.isInteger(qty) && qty > 0 && qty <= remaining ? qty : 0
  const refund = validQty * unitPrice

  const update = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Each choice resets the ones that depend on it
      ...(field === 'category' ? { product: '', saleId: '', qty: '' } : {}),
      ...(field === 'product' ? { saleId: '', qty: '' } : {}),
      ...(field === 'saleId' ? { qty: '' } : {})
    }))
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      ...(field === 'category' ? { product: undefined, saleId: undefined, qty: undefined } : {}),
      ...(field === 'product' ? { saleId: undefined, qty: undefined } : {}),
      ...(field === 'saleId' ? { qty: undefined } : {})
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!form.category) newErrors.category = 'Select a category'
    if (!form.product) newErrors.product = form.category ? 'Select a product' : 'Select a category first'
    if (!sale) newErrors.saleId = form.product ? 'Select the original sale' : 'Select a product first'
    if (!Number.isInteger(qty) || qty < 1) newErrors.qty = 'Enter a whole number of at least 1'
    else if (sale && qty > remaining) newErrors.qty = `Only ${remaining} ${remaining === 1 ? 'unit' : 'units'} from this sale can still be returned`
    if (!form.reason) newErrors.reason = 'Select a reason'
    if (!form.condition) newErrors.condition = 'Select the item condition'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({ sale, qty, reason: form.reason, condition: form.condition, refund: Math.round(refund * 100) / 100 })
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="customer-return-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper warning">
              <Undo2 size={20} />
            </div>
            <div>
              <h2 id="customer-return-title">Record Customer Return</h2>
              <p className="page-desc">Refund a customer for items brought back from an earlier sale.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="return-category">Category *</label>
            <select id="return-category" autoFocus className={`input-field ${errors.category ? 'error' : ''}`} value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">{returnable.length ? 'Select category…' : 'No sales left to return'}</option>
              {returnCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <span className="error-msg">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="return-product">Product Name *</label>
            <select id="return-product" className={`input-field ${errors.product ? 'error' : ''}`} value={form.product} onChange={(e) => update('product', e.target.value)} disabled={!form.category}>
              <option value="">{form.category ? 'Select product…' : 'Select a category first'}</option>
              {categoryProducts.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {errors.product && <span className="error-msg">{errors.product}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="return-sale">Original Sale *</label>
            <select id="return-sale" className={`input-field ${errors.saleId ? 'error' : ''}`} value={form.saleId} onChange={(e) => update('saleId', e.target.value)} disabled={!form.product}>
              <option value="">{form.product ? 'Select sale…' : 'Select a product first'}</option>
              {productSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.date} · {s.customer} · {branchById(s.branchId)?.name} · {s.qty} sold
                </option>
              ))}
            </select>
            {errors.saleId && <span className="error-msg">{errors.saleId}</span>}
            {sale && (
              <span className="field-hint">
                {formatMoney(unitPrice)} per unit · {remaining} of {sale.qty} can be returned
              </span>
            )}
          </div>

          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="return-qty">Quantity Returned *</label>
              <input id="return-qty" type="number" min="1" max={remaining || undefined} step="1" placeholder="Units returned" className={`input-field ${errors.qty ? 'error' : ''}`} value={form.qty} onChange={(e) => update('qty', e.target.value)} disabled={!sale} />
              {errors.qty && <span className="error-msg">{errors.qty}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="return-reason">Reason *</label>
              <select id="return-reason" className={`input-field ${errors.reason ? 'error' : ''}`} value={form.reason} onChange={(e) => update('reason', e.target.value)}>
                <option value="">Select reason…</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.reason && <span className="error-msg">{errors.reason}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="return-condition">Item Condition *</label>
            <select id="return-condition" className={`input-field ${errors.condition ? 'error' : ''}`} value={form.condition} onChange={(e) => update('condition', e.target.value)}>
              <option value="">Select condition…</option>
              {Object.entries(RETURN_CONDITIONS).map(([key, hint]) => (
                <option key={key} value={key}>{key} — {hint}</option>
              ))}
            </select>
            {errors.condition && <span className="error-msg">{errors.condition}</span>}
          </div>

          <div className="sale-summary">
            <div><small>Unit Price</small><strong>{sale ? formatMoney(unitPrice) : '—'}</strong></div>
            <div><small>Stock</small><strong>{form.condition === 'Resellable' ? `+${validQty} back to shelf` : form.condition === 'Damaged' ? 'Written off' : '—'}</strong></div>
            <div><small>Refund</small><strong className="negative-text">{formatMoney(refund)}</strong></div>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-action-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-action-btn">
              <Undo2 size={16} /> Record Return
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const SUPPLIER_RETURN_REASONS = ['Expired / near expiry', 'Damaged on arrival', 'Wrong item delivered', 'Product recall', 'Overstock']

const EMPTY_SUPPLIER_RETURN_FORM = { category: '', product: '', purchaseId: '', qty: '', reason: '' }

// Sends bought stock back to the supplier; the supplier owes a credit at the purchase's unit cost
function SupplierReturnModal({ purchases, returnedQty, inventory, products, branchById, formatMoney, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_SUPPLIER_RETURN_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

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

// Roles the Owner can give to staff accounts; each works at one branch.
// The Owner account itself is not created here: it covers all branches and manages these accounts.
const ACCOUNT_ROLES = {
  Pharmacist: 'Inventory Officer: manages inventory, stock levels, transfers, damaged items',
  Cashier: 'Records sales and customer returns',
  'Purchase Officer': 'Creates purchases and supplier returns'
}

const EMPTY_ACCOUNT_FORM = { fullName: '', email: '', role: '', branchId: '', status: 'Active' }

// Create or edit a staff login account
function AccountModal({ account, accounts, branches, onClose, onSave }) {
  const isEdit = Boolean(account?.id)
  const isOwner = account?.role === 'Owner'
  const [form, setForm] = useState(
    isEdit
      ? { fullName: account.fullName, email: account.email, role: account.role || 'Pharmacist', branchId: account.branchId, status: account.status }
      : EMPTY_ACCOUNT_FORM
  )
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const update = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      return next
    })
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'role' ? { branchId: undefined } : {}) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    const email = form.email.trim().toLowerCase()
    if (!form.role) newErrors.role = 'Select a role'
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!email) newErrors.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Enter a valid email address'
    else if (accounts.some((a) => a.id !== account?.id && a.email.toLowerCase() === email)) newErrors.email = 'Another account already uses this email'
    if (!form.branchId) newErrors.branchId = 'Assign a branch'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({ fullName: form.fullName.trim(), email, role: form.role, branchId: form.branchId, status: form.status })
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`account-${name}`}>{label}</label>
      <input id={`account-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={update(name)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <UserCog size={20} />
            </div>
            <div>
              <h2 id="account-modal-title">{isEdit ? 'Edit Account' : 'Create Account'}</h2>
              <p className="page-desc">{isEdit ? `Update ${account.fullName}'s account.` : 'Give a staff member a login with their role and branch.'}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Staff Member</div>
          {field('fullName', 'Full Name *', { placeholder: 'e.g. Meron Alemayehu', autoFocus: true })}
          {field('email', 'Email *', { type: 'email', placeholder: 'name@pharmacare.io', autoComplete: 'off' })}

          <div className="modal-section-title">Access</div>
          <div className="form-group">
            <label htmlFor="account-role">Role *</label>
            {isOwner ? (
              <input id="account-role" className="input-field" value="Owner" readOnly disabled />
            ) : (
              <select id="account-role" className={`input-field ${errors.role ? 'error' : ''}`} value={form.role} onChange={update('role')}>
                <option value="">Select role…</option>
                {Object.keys(ACCOUNT_ROLES).map((role) => (
                  <option key={role} value={role}>{role === 'Pharmacist' ? 'Pharmacist (Inventory Officer)' : role}</option>
                ))}
              </select>
            )}
            {isOwner
              ? <span className="field-hint">The Owner manages all branches and staff accounts. This role can't be changed.</span>
              : errors.role
                ? <span className="error-msg">{errors.role}</span>
                : form.role && <span className="field-hint">{ACCOUNT_ROLES[form.role]}</span>}
          </div>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="account-branch">Assigned Branch *</label>
              <select id="account-branch" className={`input-field ${errors.branchId ? 'error' : ''}`} value={form.branchId} onChange={update('branchId')} disabled={isOwner}>
                <option value="">Select branch…</option>
                {isOwner && <option value="all">All Branches</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.status === 'Inactive' ? ' (inactive)' : ''}</option>
                ))}
              </select>
              {errors.branchId && <span className="error-msg">{errors.branchId}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="account-status">Status</label>
              <select id="account-status" className="input-field" value={form.status} onChange={update('status')} disabled={isOwner}>
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
              {isEdit ? <><Save size={16} /> Save Changes</> : <><UserPlus size={16} /> Create Account</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const isWholeNumber = (value, min, max = Infinity) => Number.isInteger(Number(value)) && value !== '' && Number(value) >= min && Number(value) <= max

// Settings: one Minimum Stock Level that applies to every product at every branch
function SettingsPanel({ settings, onSave }) {
  const [value, setValue] = useState(String(settings.defaultMinStock))
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const isDirty = value !== String(settings.defaultMinStock)

  const handleSave = (e) => {
    e.preventDefault()
    if (!isWholeNumber(value, 0)) {
      setError('Enter a whole number of 0 or more')
      return
    }
    onSave({ ...settings, defaultMinStock: Number(value) })
    setValue(String(Number(value)))
    setNotice(`Saved. Any product with fewer than ${Number(value)} units at a branch will now show as Low Stock.`)
  }

  return (
    <div className="content-section-card settings-panel">
      <div className="section-header">
        <div>
          <h2 className="page-title">Policy</h2>
          <p className="page-desc">Applies to every product at all branches.</p>
        </div>
      </div>

      {notice && (
        <div className="success-notice">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      <form className="settings-box min-stock-box" onSubmit={handleSave} noValidate>
        <div className="form-group">
          <label htmlFor="settings-min-stock">Minimum Stock Level (units)</label>
          <input
            id="settings-min-stock"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 4"
            className={`input-field ${error ? 'error' : ''}`}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
              setNotice(null)
            }}
          />
          {error
            ? <span className="error-msg">{error}</span>
            : <span className="field-hint">A branch with fewer units than this is flagged Low Stock; at 0 it is Out of Stock.</span>}
        </div>
        <button type="submit" className="primary-action-btn" disabled={!isDirty}>
          <Save size={16} /> Save
        </button>
      </form>
    </div>
  )
}

const AUDIT_MODULES = ['Accounts', 'Sales', 'Customer Returns', 'Purchase', 'Supplier Returns', 'Stock Transfers', 'Damaged', 'Inventory', 'Branches', 'Policy']

// Read-only history of important actions, newest first, with search and a module filter
const IDLE_AFTER_MINUTES = 15

// Demo sessions store "minutes ago" so they always look current; the signed-in user's own session is added live
const buildInitialSessions = (userEmail) => {
  const now = Date.now()
  const at = (minutesAgo) => (minutesAgo == null ? null : new Date(now - minutesAgo * 60000))
  const demo = SESSIONS.map((s) => ({
    id: s.id,
    email: s.email,
    device: s.device,
    ip: s.ip,
    signedInAt: at(s.signedInMinutesAgo),
    lastActiveAt: at(s.lastActiveMinutesAgo),
    endedAt: at(s.endedMinutesAgo),
    status: s.status
  }))
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  const current = { id: 'SES-CURRENT', email: (userEmail || 'pharmacist@pharmacare.io').toLowerCase(), device: `${browser} on ${os}`, ip: 'This device', signedInAt: new Date(now), lastActiveAt: new Date(now), endedAt: null, status: 'Open', current: true }
  return [current, ...demo]
}

const minutesBetween = (later, earlier) => Math.max(0, Math.round((later - earlier) / 60000))

const timeAgo = (date, now) => {
  const minutes = minutesBetween(now, date)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const formatSessionTime = (date, now) => {
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return toDateKey(date) === toDateKey(now) ? `Today ${time}` : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

// Open sessions are Active while used recently, then Idle; ended sessions keep their end time
const sessionState = (session, now) => {
  if (session.status === 'Ended') return 'Ended'
  return minutesBetween(now, session.lastActiveAt) > IDLE_AFTER_MINUTES ? 'Idle' : 'Active'
}

function SessionsPanel({ sessions, accounts, branchById, now, onEnd, onEndIdle, onSignOut }) {
  const [showEnded, setShowEnded] = useState(false)
  const withState = sessions.map((s) => ({ ...s, state: sessionState(s, now), account: accounts.find((a) => a.email.toLowerCase() === s.email) }))
  const active = withState.filter((s) => s.state === 'Active').length
  const idle = withState.filter((s) => s.state === 'Idle')
  const signedInToday = withState.filter((s) => toDateKey(s.signedInAt) === toDateKey(now)).length
  const visible = withState
    .filter((s) => showEnded || s.state !== 'Ended')
    .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.lastActiveAt - a.lastActiveAt)

  return (
    <div className="sessions-section">
      <div className="section-header">
        <div>
          <h3><Monitor size={18} /> Session Monitoring &amp; Management</h3>
          <p className="page-desc">See who is signed in, on which device, and end sessions when needed. Sessions go idle after {IDLE_AFTER_MINUTES} minutes without activity.</p>
        </div>
        <button type="button" className="secondary-action-btn" onClick={onEndIdle} disabled={!idle.some((s) => !s.current)}>
          <LogOut size={16} /> End Idle Sessions
        </button>
      </div>

      <div className="stats-grid" style={{ margin: '1.25rem 0' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Sessions</span>
            <div className="stat-icon-wrapper teal">
              <Monitor size={20} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-chip positive">Used in the last {IDLE_AFTER_MINUTES} min</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Idle Sessions</span>
            <div className="stat-icon-wrapper warning">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">{idle.length}</div>
          <div className="stat-chip negative">Signed in but inactive</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Signed In Today</span>
            <div className="stat-icon-wrapper cyan">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="stat-value">{signedInToday}</div>
          <div className="stat-chip neutral">New sessions today</div>
        </div>
      </div>

      <div className="filter-summary" style={{ marginTop: 0 }}>
        <span>
          <Filter size={14} /> <strong>{visible.length}</strong> {visible.length === 1 ? 'session' : 'sessions'} shown
        </span>
        <label className="inline-check">
          <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /> Show ended sessions
        </label>
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Staff Member</th>
              <th>Branch</th>
              <th>Device</th>
              <th>IP Address</th>
              <th>Signed In</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, index) => {
              const role = s.account?.role
              return (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td className="nowrap">
                    <span className="fw-600">{s.account?.fullName || s.email}</span>
                    {s.current && <span className="current-chip">This device</span>}
                    {role && <span className={`role-tag role-${role.toLowerCase().replace(' ', '-')} session-role`}>{role}</span>}
                  </td>
                  <td>
                    {!s.account ? '—' : s.account.branchId === 'all'
                      ? <span className="branch-tag"><Building2 size={12} /> All Branches</span>
                      : <BranchTag branch={branchById(s.account.branchId)} />}
                  </td>
                  <td className="nowrap">{s.device}</td>
                  <td className="font-mono">{s.ip}</td>
                  <td className="nowrap">{formatSessionTime(s.signedInAt, now)}</td>
                  <td className="nowrap">{s.state === 'Ended' ? `Ended ${timeAgo(s.endedAt, now)}` : timeAgo(s.lastActiveAt, now)}</td>
                  <td><StatusTag status={s.state} /></td>
                  <td>
                    {s.state === 'Ended' ? (
                      <span className="not-set">—</span>
                    ) : s.current ? (
                      <button type="button" className="link-btn" onClick={onSignOut}>
                        <LogOut size={14} /> Sign Out
                      </button>
                    ) : (
                      <button type="button" className="link-btn danger-link" onClick={() => onEnd(s)}>
                        <LogOut size={14} /> End Session
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan="9" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No sessions to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditLogPanel({ logs }) {
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('all')
  const query = search.trim().toLowerCase()
  const sorted = [...logs].sort((a, b) => (b.date + b.time + b.id).localeCompare(a.date + a.time + a.id))
  const visible = sorted.filter(
    (l) =>
      (module === 'all' || l.module === module) &&
      (!query || [l.action, l.record, l.description].some((field) => field.toLowerCase().includes(query)))
  )
  const today = toDateKey(new Date())
  const todayCount = logs.filter((l) => l.date === today).length

  return (
    <div className="content-section-card">
      <div className="section-header">
        <div>
          <h2 className="page-title">Audit Logs</h2>
          <p className="page-desc">Track important actions performed in the system.</p>
        </div>
        <span className="unsaved-chip audit-today-chip">{todayCount} {todayCount === 1 ? 'action' : 'actions'} today</span>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search action, record, or description..."
            aria-label="Search audit logs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field filter-select" aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">All Modules</option>
          {AUDIT_MODULES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{visible.length}</strong> of {logs.length} actions
        </span>
        {(query || module !== 'all') && (
          <button type="button" className="link-btn" onClick={() => { setSearch(''); setModule('all') }}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Time</th>
              <th>Module</th>
              <th>Action</th>
              <th>Record</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l, index) => (
              <tr key={l.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{l.date}</td>
                <td className="nowrap">{l.time}</td>
                <td><span className="batch-badge">{l.module}</span></td>
                <td className="fw-600 nowrap">{l.action}</td>
                <td className="font-mono">{l.record}</td>
                <td className="audit-description">{l.description}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan="7" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No actions match your search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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


const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock']

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

// Edit one Inventory row: stock, batch and expiry belong to this branch; prices belong to the product at every branch
function EditInventoryModal({ item, branchName, onClose, onSave }) {
  const [form, setForm] = useState({
    stock: String(item.stock),
    batch: item.batch,
    expiry: item.expiry,
    purchasePrice: String(item.purchasePrice ?? ''),
    sellingPrice: item.sellingPrice == null ? '' : String(item.sellingPrice)
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!isWholeNumber(form.stock, 0)) newErrors.stock = 'Enter a whole number of 0 or more'
    if (!form.batch.trim()) newErrors.batch = 'Batch number is required'
    if (!form.expiry) newErrors.expiry = 'Expiration date is required'
    const purchasePrice = Number(form.purchasePrice)
    const sellingPrice = Number(form.sellingPrice)
    if (form.purchasePrice === '' || Number.isNaN(purchasePrice) || purchasePrice <= 0) newErrors.purchasePrice = 'Enter a price greater than 0'
    if (form.sellingPrice === '' || Number.isNaN(sellingPrice) || sellingPrice <= 0) newErrors.sellingPrice = 'Enter a price greater than 0'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    onSave({
      stock: Number(form.stock),
      batch: form.batch.trim().toUpperCase(),
      expiry: form.expiry,
      purchasePrice: Math.round(purchasePrice * 100) / 100,
      sellingPrice: Math.round(sellingPrice * 100) / 100
    })
  }

  const field = (name, label, props = {}) => (
    <div className="form-group">
      <label htmlFor={`edit-inv-${name}`}>{label}</label>
      <input id={`edit-inv-${name}`} className={`input-field ${errors[name] ? 'error' : ''}`} value={form[name]} onChange={update(name)} {...props} />
      {errors[name] && <span className="error-msg">{errors[name]}</span>}
    </div>
  )

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-inv-title">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="stat-icon-wrapper cyan">
              <Pencil size={20} />
            </div>
            <div>
              <h2 id="edit-inv-title">Edit Inventory Item</h2>
              <p className="page-desc">{item.name} at {branchName}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-grid">
            <div className="form-group">
              <label htmlFor="edit-inv-name">Product Name</label>
              <input id="edit-inv-name" className="input-field" value={item.name} readOnly disabled />
            </div>
            <div className="form-group">
              <label htmlFor="edit-inv-branch">Branch</label>
              <input id="edit-inv-branch" className="input-field" value={branchName} readOnly disabled />
            </div>
          </div>

          <div className="modal-section-title">This branch</div>
          {field('stock', 'Current Stock (units) *', { type: 'number', min: '0', step: '1', autoFocus: true })}
          <div className="modal-grid">
            {field('batch', 'Batch Number *', { placeholder: 'e.g. BT-9120' })}
            {field('expiry', 'Expiration Date *', { type: 'date' })}
          </div>

          <div className="modal-section-title">Prices · all branches</div>
          <div className="modal-grid">
            {field('purchasePrice', 'Purchase Price (per unit) *', { type: 'number', min: '0', step: '0.01' })}
            {field('sellingPrice', 'Selling Price (per unit) *', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' })}
          </div>
          <span className="field-hint">Changing a price updates {item.name} at every branch.</span>

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

function InventoryTable({ data, branches, categories, showBranch, formatMoney, onEdit, onDelete }) {
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
      {
        accessorKey: 'expiry',
        header: 'Expiration Date',
        sortFn: 'text',
        cell: (info) =>
          info.row.original.expiringSoon ? (
            <span className="expiry-warning" title="Expiring soon">
              <Clock size={13} /> {info.getValue()}
            </span>
          ) : (
            info.getValue()
          )
      },
      { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: (info) => {
          const item = info.row.original
          return (
            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="icon-btn" onClick={() => onEdit(item)} aria-label={`Edit ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Edit">
                <Pencil size={15} />
              </button>
              <button type="button" className="icon-danger-btn" onClick={() => onDelete(item)} aria-label={`Delete ${item.name} at ${branches.find((b) => b.id === item.branchId)?.name}`} title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          )
        }
      }
    ]
  }, [branches, showBranch, formatMoney, onEdit, onDelete])

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
// Chart colours per theme: validated categorical pairs (blue, orange) + recessive chrome
const CHART_THEMES = {
  dark: { series1: '#3987e5', series2: '#d95926', deEmphasis: '#475569', grid: '#1f2937', axis: '#64748b', surface: '#111827' },
  light: { series1: '#2a78d6', series2: '#eb6834', deEmphasis: '#cbd5e1', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff' }
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

function DashboardCharts({ branchId, branches, rows, categoryRows, categories, formatMoney, currencySymbol, theme }) {
  const CHART_COLORS = CHART_THEMES[theme] || CHART_THEMES.dark
  const axisProps = {
    stroke: CHART_COLORS.grid,
    tick: { fill: CHART_COLORS.axis, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: CHART_COLORS.grid }
  }
  const inBranch = (id) => branchId === 'all' || id === branchId
  const money = (v) => formatMoney(v)
  const axisMoney = (v) => `${v < 0 ? '-' : ''}${currencySymbol}${compactNumber(Math.abs(v))}`

  // Daily totals for the selected branch (or the whole network) within the date filter
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const daily = dates.map((date) => {
    const dayRows = rows.filter((r) => r.date === date && inBranch(r.branchId))
    const sum = (field) => Math.round(dayRows.reduce((s, r) => s + r[field], 0) * 100) / 100
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
  const hasTrend = daily.length >= 2
  const rangeLabel = dates.length ? `Daily · ${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : 'No data in this period'

  // Revenue per branch over the period; the selected branch is emphasised, the rest go gray
  const byBranch = branches
    .map((b) => ({
      id: b.id,
      name: b.name.replace(' Branch', '').replace(' (HQ)', ' HQ'),
      fullName: b.name,
      revenue: Math.round(rows.filter((r) => r.branchId === b.id).reduce((s, r) => s + r.revenue, 0) * 100) / 100
    }))
    .filter((b) => b.revenue > 0)

  // Units sold per category for the selected scope and period, highest first
  const byCategory = categories
    .map((category) => {
      const catRows = categoryRows.filter((r) => r.category === category && inBranch(r.branchId))
      return {
        category,
        unitsSold: catRows.reduce((s, r) => s + r.unitsSold, 0),
        revenue: Math.round(catRows.reduce((s, r) => s + r.revenue, 0) * 100) / 100
      }
    })
    .filter((c) => c.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)

  // A trend needs at least two days; a single day (e.g. Today) shows a short note instead
  const trendOrNote = (chart) =>
    hasTrend ? chart : (
      <div className="chart-empty">
        <Clock size={20} />
        <span>{daily.length ? 'Only one day in this period. Choose a longer period to see a trend.' : 'No data in this period.'}</span>
      </div>
    )

  const ticksFor = (...fields) => {
    const ticks = niceTicks(daily.flatMap((d) => fields.map((f) => d[f])))
    return { ticks, domain: [ticks[0], ticks[ticks.length - 1]], interval: 0 }
  }
  const branchTicks = niceTicks(byBranch.map((b) => b.revenue))
  const categoryTicks = niceTicks(byCategory.map((c) => c.unitsSold))
  const emptyBar = (items) => !items.length && (
    <div className="chart-empty">
      <Clock size={20} />
      <span>No sales in this period.</span>
    </div>
  )

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
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={compactNumber} width={48} {...axisProps} axisLine={false} {...ticksFor('transactions')} />
            {tooltip((v) => `${v.toLocaleString()} transactions`)}
            <Area type="monotone" dataKey="transactions" name="Sales" stroke={CHART_COLORS.series1} strokeWidth={2} fill={CHART_COLORS.series1} fillOpacity={0.1} activeDot={activeDot(CHART_COLORS.series1)} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Purchases Over Time" subtitle={`Stock purchased from suppliers · ${rangeLabel}`} table={timeTable('purchases', 'Purchases', money)}>
        {trendOrNote(
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={axisMoney} width={48} {...axisProps} axisLine={false} {...ticksFor('purchases')} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip formatValue={money} labelFormatter={shortDate} />} />
            <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS.series1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Revenue & Expenses"
        subtitle={`Sales revenue vs operating expenses · ${rangeLabel}`}
        legend={[{ label: 'Revenue', color: CHART_COLORS.series1 }, { label: 'Expenses', color: CHART_COLORS.series2 }]}
        table={{ columns: ['Date', 'Revenue', 'Expenses'], rows: daily.map((d) => [shortDate(d.date), money(d.revenue), money(d.expenses)]) }}
      >
        {trendOrNote(
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
        )}
      </ChartCard>

      <ChartCard title="Profit Over Time" subtitle={`Revenue − cost of goods − expenses · ${rangeLabel}`} table={timeTable('profit', 'Profit', money)}>
        {trendOrNote(
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
        )}
      </ChartCard>

      <ChartCard
        title="Sales by Branch"
        subtitle={branchId === 'all' ? `Revenue per branch · ${rangeLabel.replace('Daily · ', '')}` : `Selected branch highlighted · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Branch', 'Revenue'], rows: byBranch.map((b) => [b.fullName, money(b.revenue)]) }}
      >
        {emptyBar(byBranch) || (
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
        )}
      </ChartCard>

      <ChartCard
        title="Top-Selling Categories"
        subtitle={`Units sold by category · ${rangeLabel.replace('Daily · ', '')}`}
        table={{ columns: ['Category', 'Units Sold', 'Revenue'], rows: byCategory.map((c) => [c.category, c.unitsSold.toLocaleString(), money(c.revenue)]) }}
      >
        {emptyBar(byCategory) || (
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
        )}
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
  const [dateFilter, setDateFilter] = useState({ preset: 'month', from: '', to: '' })
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
  const [editingInventory, setEditingInventory] = useState(null)
  const [showNewSale, setShowNewSale] = useState(false)
  const [transfers, setTransfers] = useState(TRANSFERS)
  const [damaged, setDamaged] = useState(DAMAGED)
  const [customerReturns, setCustomerReturns] = useState(CUSTOMER_RETURNS)
  const [supplierReturns, setSupplierReturns] = useState(SUPPLIER_RETURNS)
  const [showSupplierReturn, setShowSupplierReturn] = useState(false)
  const [supplierReturnNotice, setSupplierReturnNotice] = useState(null)
  const [showRecordReturn, setShowRecordReturn] = useState(false)
  const [returnNotice, setReturnNotice] = useState(null)
  const [showRecordDamage, setShowRecordDamage] = useState(false)
  const [damageNotice, setDamageNotice] = useState(null)
  const [purchases, setPurchases] = useState(PURCHASES)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [purchaseNotice, setPurchaseNotice] = useState(null)
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [transferNotice, setTransferNotice] = useState(null)
  const [saleNotice, setSaleNotice] = useState(null)
  const inventory = buildInventory(settings, stockLevels, products)
  const [notificationState, setNotificationState] = useState(loadNotificationState)

  const [auditLogs, setAuditLogs] = useState(AUDIT_LOGS)
  const [theme, setTheme] = useState(loadTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    persistTheme(theme)
    // The login screen is dark-only, so drop the theme when the dashboard closes
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  // Records an important action in the Audit Log with the current date and time
  const addLog = (action, module, record, description) => {
    const now = new Date()
    setAuditLogs((prev) => {
      const nextNumber = Math.max(0, ...prev.map((l) => Number(String(l.id).split('-')[1]) || 0)) + 1
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      return [{ id: `LOG-${String(nextNumber).padStart(4, '0')}`, date: toDateKey(now), time, action, module, record, description }, ...prev]
    })
  }

  const [accounts, setAccounts] = useState(ACCOUNTS)
  const [editingAccount, setEditingAccount] = useState(null)
  const [accountNotice, setAccountNotice] = useState(null)
  const isOwnAccount = (account) => account.email.toLowerCase() === (userEmail || '').toLowerCase()
  const signedInAccount = accounts.find(isOwnAccount)
  const [sessions, setSessions] = useState(() => buildInitialSessions(userEmail))
  // A clock for "x min ago" and Active/Idle; refreshed every 30 seconds
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const endSessions = (shouldEnd, reason) => {
    const endedAt = new Date()
    const ended = sessions.filter((s) => s.status !== 'Ended' && !s.current && shouldEnd(s))
    if (!ended.length) return 0
    setSessions((prev) => prev.map((s) => (ended.some((e) => e.id === s.id) ? { ...s, status: 'Ended', endedAt } : s)))
    ended.forEach((s) => addLog('Session ended', 'Accounts', s.id, `${s.email} signed out on ${s.device} (${reason}).`))
    return ended.length
  }

  const handleEndSession = (session) => {
    if (!window.confirm(`End ${session.email}'s session on ${session.device}? They will be signed out on that device.`)) return
    endSessions((s) => s.id === session.id, 'ended by the Owner')
    setAccountNotice({ type: 'success', text: `${session.email} was signed out on ${session.device}.` })
  }

  const handleEndIdleSessions = () => {
    const count = endSessions((s) => sessionState(s, now) === 'Idle', `idle for more than ${IDLE_AFTER_MINUTES} minutes`)
    setAccountNotice({ type: 'success', text: count ? `${count} idle ${count === 1 ? 'session was' : 'sessions were'} ended.` : 'There are no idle sessions to end.' })
  }

  const handleSaveAccount = (data) => {
    const branchName = data.branchId === 'all' ? 'All Branches' : branchById(data.branchId)?.name
    if (editingAccount?.id) {
      setAccounts((prev) => prev.map((a) => (a.id === editingAccount.id ? { ...a, ...data } : a)))
      addLog('Account updated', 'Accounts', editingAccount.id, `${data.fullName} (${data.email}) updated: ${data.role}, ${branchName}, ${data.status}.`)
      setAccountNotice({ type: 'success', text: `${data.fullName}'s account was updated.` })
    } else {
      const nextNumber = Math.max(0, ...accounts.map((a) => Number(String(a.id).split('-')[1]) || 0)) + 1
      const id = `ACC-${String(nextNumber).padStart(3, '0')}`
      setAccounts((prev) => [...prev, { id, ...data, createdAt: toDateKey(new Date()) }])
      addLog('Account created', 'Accounts', id, `${data.role} account for ${data.fullName} (${data.email}) at ${branchName}, ${data.status}.`)
      setAccountNotice({ type: 'success', text: `Account created for ${data.fullName}. They can sign in with ${data.email}.` })
    }
    setEditingAccount(null)
  }

  const handleToggleAccountStatus = (account) => {
    if (account.role === 'Owner') {
      setAccountNotice({ type: 'error', text: "The Owner account can't be deactivated." })
      return
    }
    if (isOwnAccount(account)) {
      setAccountNotice({ type: 'error', text: "You can't deactivate the account you are signed in with." })
      return
    }
    const status = account.status === 'Active' ? 'Inactive' : 'Active'
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status } : a)))
    if (status === 'Inactive') endSessions((s) => s.email === account.email.toLowerCase(), 'account deactivated')
    addLog(status === 'Active' ? 'Account activated' : 'Account deactivated', 'Accounts', account.id, `${account.fullName} (${account.email}) is now ${status}.`)
    setAccountNotice({ type: 'success', text: status === 'Active' ? `${account.fullName} can sign in again.` : `${account.fullName} can no longer sign in.` })
  }

  const handleDeleteAccount = (account) => {
    if (account.role === 'Owner') {
      setAccountNotice({ type: 'error', text: "The Owner account can't be deleted." })
      return
    }
    if (isOwnAccount(account)) {
      setAccountNotice({ type: 'error', text: "You can't delete the account you are signed in with." })
      return
    }
    if (!window.confirm(`Delete the account for ${account.fullName}? They will no longer be able to sign in.`)) return
    setAccounts((prev) => prev.filter((a) => a.id !== account.id))
    endSessions((s) => s.email === account.email.toLowerCase(), 'account deleted')
    addLog('Account deleted', 'Accounts', account.id, `${account.fullName} (${account.email}) was deleted.`)
    setAccountNotice({ type: 'success', text: `${account.fullName}'s account was deleted.` })
  }

  const handleSaveSettings = (next) => {
    if (next.defaultMinStock !== settings.defaultMinStock) {
      addLog('Minimum stock level changed', 'Policy', 'Minimum Stock Level', `Changed from ${settings.defaultMinStock} to ${next.defaultMinStock} units for every product at all branches.`)
    }
    setSettings(next)
    persistSettings(next)
  }

  const handleAddBranch = (data) => {
    const nextNumber = Math.max(0, ...branches.map((b) => Number(b.id.split('-')[1]))) + 1
    const newBranch = { ...data, id: `BR-${String(nextNumber).padStart(2, '0')}`, revenue: 0, expenses: 0 }
    setBranches((prev) => [...prev, newBranch])
    setShowAddBranch(false)
    setBranchNotice({ type: 'success', text: `${newBranch.name} (${newBranch.id}) was added successfully.` })
    addLog('Branch added', 'Branches', newBranch.id, `${newBranch.name} added at ${newBranch.location} (${newBranch.status}).`)
  }

  const handleEditBranch = (data) => {
    setBranches((prev) => prev.map((b) => (b.id === editingBranch.id ? { ...b, ...data } : b)))
    setEditingBranch(null)
    setBranchNotice({ type: 'success', text: `${data.name} was updated.` })
    addLog('Branch updated', 'Branches', editingBranch.id, `${editingBranch.name} updated: name "${data.name}", location "${data.location}", status ${data.status}.`)
  }

  const handleToggleBranchStatus = (branch) => {
    const status = branch.status === 'Active' ? 'Inactive' : 'Active'
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, status } : b)))
    addLog(status === 'Active' ? 'Branch activated' : 'Branch deactivated', 'Branches', branch.id, `${branch.name} is now ${status}.`)
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
      damaged.some((d) => d.branchId === branch.id) ||
      customerReturns.some((r) => r.branchId === branch.id) ||
      supplierReturns.some((r) => r.branchId === branch.id) ||
      accounts.some((a) => a.branchId === branch.id) ||
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
    addLog('Branch deleted', 'Branches', branch.id, `${branch.name} (${branch.location}) was deleted.`)
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

  // Units on hand and distinct products in stock for the Dashboard branch filter
  const dashboardStock = inventory.filter((i) => inDashboard(i.branchId) && i.stock > 0)
  const dashboardStockUnits = dashboardStock.reduce((sum, i) => sum + i.stock, 0)
  const dashboardProductCount = new Set(dashboardStock.map((i) => i.medId)).size
  const dashboardLowStock = inventory.filter((i) => inDashboard(i.branchId) && i.status === 'Low Stock').length
  const dashboardOutOfStock = inventory.filter((i) => inDashboard(i.branchId) && i.status === 'Out of Stock').length
  // Batches still on the shelf that are close to their expiry date
  const dashboardExpiringSoon = inventory.filter((i) => inDashboard(i.branchId) && i.expiringSoon && i.stock > 0).length

  const totalRevenue = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + b.revenue, 0)
  const totalExpenses = branches.filter((b) => inDashboard(b.id)).reduce((sum, b) => sum + b.expenses, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0
  const lowStockCount = scopedInventory.filter((i) => i.status !== 'In Stock').length
  const expiringCount = scopedInventory.filter((i) => i.expiringSoon).length
  const salesTotal = scopedSales.reduce((sum, s) => sum + s.total, 0)
  const salesUnitsSold = scopedSales.reduce((sum, s) => sum + s.qty, 0)
  const salesTodayList = scopedSales.filter((s) => s.date === toDateKey(new Date()))
  const salesTodayTotal = salesTodayList.reduce((sum, s) => sum + s.total, 0)
  const salesTodayUnits = salesTodayList.reduce((sum, s) => sum + s.qty, 0)

  // Daily performance: the history file covers past days; today comes from live records
  const todayKey = toDateKey(new Date())
  const costOfSale = (s) => (products.find((m) => m.name === s.product)?.purchasePrice || 0) * s.qty
  const refundsOn = (branchId, date) => customerReturns.filter((r) => r.branchId === branchId && r.date === date)
  const todayPerformance = branches.map((b) => {
    const branchSales = sales.filter((s) => s.branchId === b.id && s.date === todayKey)
    return {
      date: todayKey,
      branchId: b.id,
      transactions: branchSales.length,
      unitsSold: branchSales.reduce((sum, s) => sum + s.qty, 0),
      // Refunds given today reduce revenue; resellable returns also give back their cost of goods
      revenue: branchSales.reduce((sum, s) => sum + s.total, 0) - refundsOn(b.id, todayKey).reduce((sum, r) => sum + r.refund, 0),
      costOfGoods:
        branchSales.reduce((sum, s) => sum + costOfSale(s), 0) -
        refundsOn(b.id, todayKey)
          .filter((r) => r.condition === 'Resellable')
          .reduce((sum, r) => sum + (products.find((m) => m.id === r.medId)?.purchasePrice || 0) * r.qty, 0),
      // Credits from stock sent back to suppliers today reduce what was spent on purchases
      purchases:
        purchases.filter((p) => p.branchId === b.id && p.date === todayKey).reduce((sum, p) => sum + p.total, 0) -
        supplierReturns.filter((r) => r.branchId === b.id && r.date === todayKey).reduce((sum, r) => sum + r.credit, 0),
      expenses: EXPENSES.filter((e) => e.branchId === b.id && e.date === todayKey).reduce((sum, e) => sum + e.amount, 0)
    }
  })
  const performanceRows = [...DAILY_PERFORMANCE.filter((r) => r.date < todayKey), ...todayPerformance]
  const categoryRows = [
    ...CATEGORY_SALES.filter((r) => r.date < todayKey),
    ...sales.filter((s) => s.date === todayKey).map((s) => ({ date: todayKey, branchId: s.branchId, category: s.category, unitsSold: s.qty, revenue: s.total }))
  ]

  // Dashboard date filter
  const isCustomRange = dateFilter.preset === 'custom'
  const [rangeFrom, rangeTo] = isCustomRange ? [dateFilter.from, dateFilter.to] : getPresetRange(dateFilter.preset)
  const rangeInvalid = isCustomRange && (!rangeFrom || !rangeTo || rangeFrom > rangeTo)
  const inRange = (date) => !rangeInvalid && date >= rangeFrom && date <= rangeTo
  const rangeLabel = rangeInvalid ? 'Choose a valid date range' : `${DATE_PRESETS[dateFilter.preset]} · ${formatRangeLabel(rangeFrom, rangeTo)}`
  const rangeRows = performanceRows.filter((r) => inRange(r.date))
  const rangeCategoryRows = categoryRows.filter((r) => inRange(r.date))

  const changeDatePreset = (preset) => {
    // Custom starts from the range currently shown, so the pharmacist only adjusts it
    if (preset === 'custom') setDateFilter({ preset, from: rangeFrom || todayKey, to: rangeTo || todayKey })
    else setDateFilter((prev) => ({ ...prev, preset }))
  }

  // Period figures for the branch + date filters
  const periodRows = rangeRows.filter((r) => inDashboard(r.branchId))
  const periodSum = (field) => periodRows.reduce((sum, r) => sum + r[field], 0)
  const periodTransactions = periodSum('transactions')
  const periodUnitsSold = periodSum('unitsSold')
  const periodRevenue = periodSum('revenue')
  const periodPurchases = periodSum('purchases')
  const periodExpenses = periodSum('expenses')
  const periodProfit = periodRevenue - periodSum('costOfGoods') - periodExpenses

  // Branch Performance for the selected period
  const branchPeriod = (branchId) => {
    const rows = rangeRows.filter((r) => r.branchId === branchId)
    const revenue = rows.reduce((sum, r) => sum + r.revenue, 0)
    const expenses = rows.reduce((sum, r) => sum + r.costOfGoods + r.expenses, 0)
    return { revenue, expenses, profit: revenue - expenses }
  }
  const unitsTransferred = scopedTransfers.reduce((sum, t) => sum + t.qty, 0)
  const scopedDamaged = damaged.filter((d) => inScope(d.branchId))
  const scopedReturns = customerReturns.filter((r) => inScope(r.branchId))
  const returnedQuantity = scopedReturns.reduce((sum, r) => sum + r.qty, 0)
  const refundTotal = scopedReturns.reduce((sum, r) => sum + r.refund, 0)
  const scopedSupplierReturns = supplierReturns.filter((r) => inScope(r.branchId))
  const supplierReturnQuantity = scopedSupplierReturns.reduce((sum, r) => sum + r.qty, 0)
  const supplierCreditTotal = scopedSupplierReturns.reduce((sum, r) => sum + r.credit, 0)
  const returnedQtyForPurchase = (purchaseId) => supplierReturns.filter((r) => r.purchaseId === purchaseId).reduce((sum, r) => sum + r.qty, 0)
  // Purchases with stock sent back show how much was returned instead of just "Paid"
  const purchaseStatus = (po) => {
    const returned = returnedQtyForPurchase(po.id)
    if (!returned) return po.status
    return returned >= po.qty ? 'Returned' : 'Partially Returned'
  }
  const returnedQtyForSale = (saleId) => customerReturns.filter((r) => r.saleId === saleId).reduce((sum, r) => sum + r.qty, 0)
  // Sales with returns show how much was refunded instead of just "Paid"
  const saleStatus = (sale) => {
    const returned = returnedQtyForSale(sale.id)
    if (!returned) return sale.status
    return returned >= sale.qty ? 'Refunded' : 'Partially Refunded'
  }
  const damagedQuantity = scopedDamaged.reduce((sum, d) => sum + d.qty, 0)
  const damagedLoss = scopedDamaged.reduce((sum, d) => sum + d.lossValue, 0)

  // Notifications are generated from current stock, transfers, and tax policy
  const allNotifications = [
    ...scopedInventory
      .filter((i) => i.status !== 'In Stock')
      .map((i) => ({
        id: `low-${i.key}-${i.stock}`,
        type: 'low-stock',
        tab: 'inventory',
        branch: branchById(i.branchId),
        title: i.status === 'Out of Stock' ? `Out of stock: ${i.name}` : `Low stock: ${i.name}`,
        message: i.status === 'Out of Stock'
          ? 'No units left at this branch. Create a purchase or transfer stock from another branch.'
          : `Only ${i.stock} units left, below the low stock level of ${i.reorderLevel} units. Reorder or request a transfer.`,
        meta: `Batch ${i.batch}`,
        sort: 1
      })),
    ...scopedInventory
      .filter((i) => i.expiringSoon && i.stock > 0)
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
          tab: 'settings',
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
      alerts: items.filter((i) => i.status !== 'In Stock' || i.expiringSoon).length
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
    addLog('Sale recorded', 'Sales', sale.id, `${data.qty} × ${data.product} sold to ${data.customer} at ${branchById(data.branchId)?.name} for ${formatMoney(data.total)}.`)
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
    addLog('Stock transferred', 'Stock Transfers', transfer.id, `${data.qty} × ${data.product} moved from ${branchById(data.from)?.name} to ${branchById(data.to)?.name}.`)
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
      setProducts((prev) => [...prev, { id: medId, name: data.product, category: data.category, purchasePrice, sellingPrice: null, reorderLevel: settings.defaultMinStock ?? 20 }])
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
    addLog('Purchase created', 'Purchase', purchase.id, `${data.qty} × ${data.product} bought from ${data.supplier} into ${branchById(data.branchId)?.name} for ${formatMoney(data.total)}.`)
    if (!knownMedId) addLog('Product added', 'Inventory', medId, `${data.product} added to ${data.category} through purchase ${purchase.id} (purchase price ${formatMoney(purchasePrice)}).`)
  }

  // Edit one branch's stock row; prices are stored on the product, so they change at every branch
  const handleEditInventory = (data) => {
    const item = editingInventory
    const branchName = branchById(item.branchId)?.name
    setStockLevels((prev) =>
      prev.map((e) => (e.medId === item.medId && e.branchId === item.branchId ? { ...e, stock: data.stock, batch: data.batch, expiry: data.expiry } : e))
    )
    setProducts((prev) => prev.map((m) => (m.id === item.medId ? { ...m, purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice } : m)))
    const changes = [
      data.stock !== item.stock && `stock ${item.stock} → ${data.stock}`,
      data.batch !== item.batch && `batch ${item.batch} → ${data.batch}`,
      data.expiry !== item.expiry && `expiry ${item.expiry} → ${data.expiry}`,
      data.purchasePrice !== item.purchasePrice && `purchase price ${formatMoney(item.purchasePrice)} → ${formatMoney(data.purchasePrice)}`,
      data.sellingPrice !== item.sellingPrice && `selling price ${item.sellingPrice == null ? 'not set' : formatMoney(item.sellingPrice)} → ${formatMoney(data.sellingPrice)}`
    ].filter(Boolean)
    if (changes.length) addLog('Inventory item updated', 'Inventory', item.medId, `${item.name} at ${branchName}: ${changes.join(', ')}.`)
    setEditingInventory(null)
    setInventoryNotice({ type: 'success', text: changes.length ? `${item.name} at ${branchName} was updated.` : 'No changes to save.' })
  }

  // Removing a branch's row would make its units vanish without a record, so only empty rows can be deleted
  const handleDeleteInventory = (item) => {
    const branchName = branchById(item.branchId)?.name
    if (item.stock > 0) {
      setInventoryNotice({
        type: 'error',
        text: `${item.name} at ${branchName} still has ${item.stock} units. Sell, transfer, return, or record them as damaged first, then delete the empty row.`
      })
      return
    }
    if (!window.confirm(`Remove ${item.name} from ${branchName}'s inventory? The product stays available at other branches.`)) return
    setStockLevels((prev) => prev.filter((e) => !(e.medId === item.medId && e.branchId === item.branchId)))
    addLog('Inventory item deleted', 'Inventory', item.medId, `${item.name} (batch ${item.batch}) removed from ${branchName}'s inventory.`)
    setInventoryNotice({ type: 'success', text: `${item.name} was removed from ${branchName}'s inventory.` })
  }

  const handleSaveMedicine = ({ medId, name, purchasePrice, sellingPrice }) => {
    setProducts((prev) => prev.map((m) => (m.id === medId ? { ...m, purchasePrice, sellingPrice } : m)))
    setShowAddMedicine(false)
    setInventoryNotice({ type: 'success', text: `${name} is ready for sale at ${formatMoney(sellingPrice)} per unit.` })
    addLog('Product prices set', 'Inventory', medId, `${name}: purchase price ${formatMoney(purchasePrice)}, selling price ${formatMoney(sellingPrice)}.`)
  }

  // Damaged stock is written off: it leaves the branch's sellable stock and is kept as a loss record
  const handleRecordDamage = (data) => {
    const nextNumber = Math.max(0, ...damaged.map((d) => Number(String(d.id).split('-')[1]) || 0)) + 1
    const record = { id: `DMG-${nextNumber}`, ...data, date: toDateKey(new Date()) }
    setDamaged((prev) => [record, ...prev])
    setStockLevels((prev) => prev.map((e) => (e.medId === data.medId && e.branchId === data.branchId ? { ...e, stock: e.stock - data.qty } : e)))
    setShowRecordDamage(false)
    setDamageNotice(`${record.id} recorded: ${data.qty} × ${data.product} removed from ${branchById(data.branchId)?.name} stock (${formatMoney(data.lossValue)} loss).`)
    addLog('Damaged item recorded', 'Damaged', record.id, `${data.qty} × ${data.product} written off at ${branchById(data.branchId)?.name} (${data.reason}). Loss ${formatMoney(data.lossValue)}.`)
  }

  // Resellable returns go back on the shelf; damaged returns are written off on the Damaged page
  const handleRecordReturn = ({ sale, qty, reason, condition, refund }) => {
    const product = products.find((m) => m.name === sale.product)
    const stockEntry = stockLevels.find((e) => e.medId === product?.id && e.branchId === sale.branchId)
    const nextNumber = Math.max(0, ...customerReturns.map((r) => Number(String(r.id).split('-')[1]) || 0)) + 1
    const record = {
      id: `RTN-${nextNumber}`,
      saleId: sale.id,
      branchId: sale.branchId,
      customer: sale.customer,
      medId: product?.id,
      product: sale.product,
      category: sale.category,
      batch: stockEntry?.batch || '—',
      qty,
      reason,
      condition,
      refund,
      date: toDateKey(new Date())
    }
    setCustomerReturns((prev) => [record, ...prev])
    if (condition === 'Resellable') {
      setStockLevels((prev) => {
        if (prev.some((e) => e.medId === product?.id && e.branchId === sale.branchId)) {
          return prev.map((e) => (e.medId === product?.id && e.branchId === sale.branchId ? { ...e, stock: e.stock + qty } : e))
        }
        // The branch had no stock row for this product: start one with the return as its batch
        const expiry = new Date()
        expiry.setFullYear(expiry.getFullYear() + 1)
        return [...prev, { medId: product?.id, branchId: sale.branchId, stock: qty, batch: record.id, expiry: toDateKey(expiry) }]
      })
    } else {
      const nextDamage = Math.max(0, ...damaged.map((d) => Number(String(d.id).split('-')[1]) || 0)) + 1
      setDamaged((prev) => [{
        id: `DMG-${nextDamage}`,
        branchId: sale.branchId,
        medId: product?.id,
        product: sale.product,
        category: sale.category,
        batch: record.batch,
        qty,
        reason: `Customer return (${record.id})`,
        lossValue: Math.round(qty * (product?.purchasePrice || 0) * 100) / 100,
        date: record.date
      }, ...prev])
    }
    setShowRecordReturn(false)
    setReturnNotice(`${record.id} recorded: ${qty} × ${sale.product} returned to ${branchById(sale.branchId)?.name}, ${formatMoney(refund)} refunded. ${condition === 'Resellable' ? 'Units are back in stock.' : 'Units were written off as damaged.'}`)
    addLog('Customer return recorded', 'Customer Returns', record.id, `${qty} × ${sale.product} returned from sale ${sale.id} at ${branchById(sale.branchId)?.name} (${reason}); ${formatMoney(refund)} refunded, ${condition === 'Resellable' ? 'restocked' : 'written off'}.`)
  }

  // Stock sent back to a supplier leaves the branch; the supplier owes a credit for it
  const handleSupplierReturn = ({ purchase, medId, qty, reason, credit }) => {
    const nextNumber = Math.max(0, ...supplierReturns.map((r) => Number(String(r.id).split('-')[1]) || 0)) + 1
    const record = {
      id: `SRT-${nextNumber}`,
      purchaseId: purchase.id,
      branchId: purchase.branchId,
      supplier: purchase.supplier,
      medId,
      product: purchase.product,
      category: purchase.category,
      qty,
      reason,
      credit,
      date: toDateKey(new Date())
    }
    setSupplierReturns((prev) => [record, ...prev])
    setStockLevels((prev) => prev.map((e) => (e.medId === medId && e.branchId === purchase.branchId ? { ...e, stock: e.stock - qty } : e)))
    setShowSupplierReturn(false)
    setSupplierReturnNotice(`${record.id} recorded: ${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchById(purchase.branchId)?.name}. Supplier credit: ${formatMoney(credit)}.`)
    addLog('Supplier return recorded', 'Supplier Returns', record.id, `${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchById(purchase.branchId)?.name} (${reason}); credit ${formatMoney(credit)}.`)
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
          {navItem('accounts', UserCog, 'Account Provision')}
          {navItem('inventory', Package, 'Inventory', lowStockCount + expiringCount)}
          {navItem('sales', ShoppingCart, 'Sales')}
          {navItem('returns', Undo2, 'Customer Returns')}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>OPERATIONS</div>
          {navItem('orders', PackageCheck, 'Purchase')}
          {navItem('supplier-returns', PackageMinus, 'Supplier Returns')}
          {navItem('transfers', ArrowLeftRight, 'Stock Transfers')}
          {navItem('damaged', PackageX, 'Damaged')}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>ANALYTICS & AUDIT</div>
          {navItem('reports', BarChart3, 'Reports')}
          {navItem('audit', FileText, 'Audit Logs')}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>CONFIGURATION</div>
          {navItem('branches', Building2, 'Branches', branches.length)}
          {navItem('settings', ShieldCheck, 'Policy')}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">{signedInAccount ? `${signedInAccount.fullName} · ${signedInAccount.role}` : 'Pharmacist'}</span>
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
        <header className="dashboard-header">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

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
                  <Clock size={16} />
                  <span>Period</span>
                  <select className="input-field" value={dateFilter.preset} onChange={(e) => changeDatePreset(e.target.value)} aria-label="Dashboard date filter">
                    {Object.entries(DATE_PRESETS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                {isCustomRange && (
                  <div className="dashboard-filter date-range">
                    <label>
                      <span>From</span>
                      <input type="date" className={`input-field ${rangeInvalid ? 'error' : ''}`} value={dateFilter.from} max={todayKey} onChange={(e) => setDateFilter((prev) => ({ ...prev, from: e.target.value }))} aria-label="Custom range start" />
                    </label>
                    <label>
                      <span>To</span>
                      <input type="date" className={`input-field ${rangeInvalid ? 'error' : ''}`} value={dateFilter.to} max={todayKey} onChange={(e) => setDateFilter((prev) => ({ ...prev, to: e.target.value }))} aria-label="Custom range end" />
                    </label>
                  </div>
                )}

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
              {rangeInvalid && <p className="error-msg" style={{ marginTop: '-0.6rem', marginBottom: '1rem' }}>The From date must be on or before the To date.</p>}

              {/* Period Figures (follow the date + branch filters) */}
              <div className="section-label">
                <Clock size={14} /> {rangeLabel} · {dashboardScopeLabel}
              </div>
              <div className="stats-grid today-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Sales</span>
                    <div className="stat-icon-wrapper cyan">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{periodTransactions.toLocaleString()}</div>
                  <div className="stat-chip neutral">
                    {periodTransactions === 1 ? 'transaction' : 'transactions'} · {periodUnitsSold.toLocaleString()} units sold
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Purchases</span>
                    <div className="stat-icon-wrapper teal">
                      <PackageCheck size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(periodPurchases)}</div>
                  <div className="stat-chip neutral">Stock bought from suppliers</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Expenses</span>
                    <div className="stat-icon-wrapper danger">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(periodExpenses)}</div>
                  <div className="stat-chip negative">Operating costs</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(periodRevenue)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> From {periodTransactions.toLocaleString()} {periodTransactions === 1 ? 'sale' : 'sales'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Profit</span>
                    <div className={`stat-icon-wrapper ${periodProfit < 0 ? 'danger' : 'teal'}`}>
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: periodProfit < 0 ? '#fb7185' : '#34d399' }}>{formatMoney(periodProfit)}</div>
                  <div className={`stat-chip ${periodProfit < 0 ? 'negative' : 'positive'}`} title="Revenue − cost of goods sold − expenses">
                    Revenue − cost of goods − expenses
                  </div>
                </div>
              </div>

              <div className="section-label" style={{ marginTop: '1.75rem' }}>
                <BarChart3 size={14} /> Overall (all time) · {dashboardScopeLabel}
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
                    <span className="stat-title">Total Profit</span>
                    <div className="stat-icon-wrapper teal">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#34d399' }}>{formatMoney(netProfit)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> {profitMargin.toFixed(1)}% Profit Margin
                  </div>
                </div>

              </div>

              {/* Stock levels */}
              <div className="section-label" style={{ marginTop: '1.75rem' }}>
                <Package size={14} /> Stock on hand now · {dashboardScopeLabel}
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Stock</span>
                    <div className="stat-icon-wrapper cyan">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{dashboardStockUnits.toLocaleString()}</div>
                  <div className="stat-chip neutral">
                    units · {dashboardProductCount} {dashboardProductCount === 1 ? 'product' : 'products'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Low Stock</span>
                    <div className="stat-icon-wrapper warning">
                      <AlertTriangle size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{dashboardLowStock}</div>
                  <div className="stat-chip negative">
                    {dashboardLowStock === 1 ? 'item' : 'items'} below the low stock level
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Out of Stock</span>
                    <div className="stat-icon-wrapper danger">
                      <PackageX size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: dashboardOutOfStock ? '#fb7185' : undefined }}>{dashboardOutOfStock}</div>
                  <div className="stat-chip negative">
                    {dashboardOutOfStock === 1 ? 'item needs' : 'items need'} restocking
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Expiring Soon</span>
                    <div className="stat-icon-wrapper warning">
                      <Clock size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: dashboardExpiringSoon ? '#f59e0b' : undefined }}>{dashboardExpiringSoon}</div>
                  <div className="stat-chip negative">
                    {dashboardExpiringSoon === 1 ? 'batch expires' : 'batches expire'} within {settings.expiryWarningDays} days
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="section-label" style={{ marginTop: '1.75rem' }}>
                <TrendingUp size={14} /> Trends · {rangeLabel} · {dashboardScopeLabel}
              </div>
              <DashboardCharts
                theme={theme}
                branchId={dashboardBranch}
                branches={branches}
                rows={rangeRows}
                categoryRows={rangeCategoryRows}
                categories={categories}
                formatMoney={formatMoney}
                currencySymbol={(CURRENCIES[settings.currency]?.symbol || '$').trim()}
              />

              {/* Branch Performance Comparison (network view only) */}
              {isDashboardAll && (
                <div className="content-section-card" style={{ marginTop: '1.5rem' }}>
                  <div className="section-header">
                    <div>
                      <h3>Branch Performance</h3>
                      <p className="page-desc">{rangeLabel}</p>
                    </div>
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
                          <th>Total Profit</th>
                          <th>Units in Stock</th>
                          <th>Stock Alerts</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((b) => {
                          const summary = branchSummary(b.id)
                          const period = branchPeriod(b.id)
                          return (
                            <tr key={b.id}>
                              <td className="fw-600">{b.name}</td>
                              <td>{formatMoney(period.revenue)}</td>
                              <td>{formatMoney(period.expenses)}</td>
                              <td className="fw-600" style={{ color: period.profit < 0 ? '#fb7185' : '#34d399' }}>{formatMoney(period.profit)}</td>
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
                <div className={`success-notice ${inventoryNotice.type}`}>
                  {inventoryNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{inventoryNotice.text}</span>
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
                onEdit={setEditingInventory}
                onDelete={handleDeleteInventory}
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
                        <td><StatusTag status={saleStatus(sale)} /></td>
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
                        <td><StatusTag status={purchaseStatus(po)} /></td>
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
                        <th>Category</th>
                        <th>Product Name</th>
                        <th>Payment Method</th>
                        <th>Amount Paid</th>
                        <th>Transaction Date</th>
                        <th>Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedPayments.map((txn) => {
                        // Category and product come from the purchase this payment settles
                        const purchase = purchases.find((p) => p.id === txn.purchaseId)
                        return (
                        <tr key={txn.id}>
                          <td className="font-mono">{txn.id}</td>
                          {isAllBranches && <td><BranchTag branch={branchById(txn.branchId)} /></td>}
                          <td className="fw-600">{txn.supplier}</td>
                          <td>{purchase?.category || '—'}</td>
                          <td className="fw-600">{purchase?.product || '—'}</td>
                          <td><span className="batch-badge">{txn.method}</span></td>
                          <td className="fw-600">{formatMoney(txn.amount)}</td>
                          <td>{txn.date}</td>
                          <td><StatusTag status={txn.status} /></td>
                        </tr>
                        )
                      })}
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
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Batch</th>
                      <th>Quantity</th>
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
                        <td>{products.find((m) => m.name === trf.product)?.category || '—'}</td>
                        <td className="fw-600">{trf.product}</td>
                        <td><span className="batch-badge">{trf.batch}</span></td>
                        <td>{trf.qty} units</td>
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

          {activeTab === 'supplier-returns' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Supplier Returns · {scopeLabel}</h2>
                  <p className="page-desc">Purchased products sent back to suppliers, and the credits they owe.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowSupplierReturn(true)}>
                  <Plus size={16} /> Record Supplier Return
                </button>
              </div>

              {supplierReturnNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{supplierReturnNotice}</span>
                  <button type="button" onClick={() => setSupplierReturnNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Returns</span>
                    <div className="stat-icon-wrapper teal">
                      <PackageMinus size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedSupplierReturns.length}</div>
                  <div className="stat-chip neutral">Returns to suppliers</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Quantity Returned</span>
                    <div className="stat-icon-wrapper cyan">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{supplierReturnQuantity.toLocaleString()}</div>
                  <div className="stat-chip neutral">Units removed from stock</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Supplier Credit</span>
                    <div className="stat-icon-wrapper teal">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#34d399' }}>{formatMoney(supplierCreditTotal)}</div>
                  <div className="stat-chip positive">Owed back by suppliers</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Date</th>
                      {isAllBranches && <th>Branch</th>}
                      <th>Purchase</th>
                      <th>Supplier</th>
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Quantity</th>
                      <th>Reason</th>
                      <th>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedSupplierReturns.map((r, index) => (
                      <tr key={r.id}>
                        <td>{index + 1}</td>
                        <td className="nowrap">{r.date}</td>
                        {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                        <td className="font-mono">{r.purchaseId}</td>
                        <td>{r.supplier}</td>
                        <td>{r.category}</td>
                        <td className="fw-600">{r.product}</td>
                        <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                        <td>{r.reason}</td>
                        <td className="fw-600" style={{ color: '#34d399' }}>{formatMoney(r.credit)}</td>
                      </tr>
                    ))}
                    {scopedSupplierReturns.length === 0 && (
                      <tr>
                        <td colSpan={isAllBranches ? 10 : 9} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                          No supplier returns recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'returns' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Customer Returns · {scopeLabel}</h2>
                  <p className="page-desc">Items customers brought back after a sale, and the refunds given.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowRecordReturn(true)}>
                  <Plus size={16} /> Record Customer Return
                </button>
              </div>

              {returnNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{returnNotice}</span>
                  <button type="button" onClick={() => setReturnNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Returns</span>
                    <div className="stat-icon-wrapper warning">
                      <Undo2 size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedReturns.length}</div>
                  <div className="stat-chip neutral">Customer returns recorded</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Quantity Returned</span>
                    <div className="stat-icon-wrapper cyan">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{returnedQuantity.toLocaleString()}</div>
                  <div className="stat-chip neutral">
                    {scopedReturns.filter((r) => r.condition === 'Resellable').reduce((sum, r) => sum + r.qty, 0)} restocked · {scopedReturns.filter((r) => r.condition === 'Damaged').reduce((sum, r) => sum + r.qty, 0)} written off
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Refunds</span>
                    <div className="stat-icon-wrapper danger">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#fb7185' }}>{formatMoney(refundTotal)}</div>
                  <div className="stat-chip negative">Paid back to customers</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Date</th>
                      {isAllBranches && <th>Branch</th>}
                      <th>Sale</th>
                      <th>Customer</th>
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Quantity</th>
                      <th>Reason</th>
                      <th>Stock</th>
                      <th>Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedReturns.map((r, index) => (
                      <tr key={r.id}>
                        <td>{index + 1}</td>
                        <td className="nowrap">{r.date}</td>
                        {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                        <td className="font-mono">{r.saleId}</td>
                        <td>{r.customer}</td>
                        <td>{r.category}</td>
                        <td className="fw-600">{r.product}</td>
                        <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                        <td>{r.reason}</td>
                        <td><StatusTag status={r.condition === 'Resellable' ? 'Restocked' : 'Written Off'} /></td>
                        <td className="fw-600 negative-text">{formatMoney(r.refund)}</td>
                      </tr>
                    ))}
                    {scopedReturns.length === 0 && (
                      <tr>
                        <td colSpan={isAllBranches ? 11 : 10} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                          No customer returns recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'damaged' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Damaged Items · {scopeLabel}</h2>
                  <p className="page-desc">Products that were physically damaged and can no longer be sold or used.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowRecordDamage(true)}>
                  <Plus size={16} /> Record Damaged Item
                </button>
              </div>

              {damageNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{damageNotice}</span>
                  <button type="button" onClick={() => setDamageNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Damaged Records</span>
                    <div className="stat-icon-wrapper danger">
                      <PackageX size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedDamaged.length}</div>
                  <div className="stat-chip neutral">Write-offs recorded</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Quantity Damaged</span>
                    <div className="stat-icon-wrapper warning">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{damagedQuantity.toLocaleString()}</div>
                  <div className="stat-chip neutral">Units removed from stock</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Loss Value</span>
                    <div className="stat-icon-wrapper danger">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#fb7185' }}>{formatMoney(damagedLoss)}</div>
                  <div className="stat-chip negative">At purchase price</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Date</th>
                      {isAllBranches && <th>Branch</th>}
                      <th>Category</th>
                      <th>Product Name</th>
                      <th>Batch</th>
                      <th>Quantity</th>
                      <th>Reason</th>
                      <th>Loss Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedDamaged.map((d, index) => (
                      <tr key={d.id}>
                        <td>{index + 1}</td>
                        <td className="nowrap">{d.date}</td>
                        {isAllBranches && <td><BranchTag branch={branchById(d.branchId)} /></td>}
                        <td>{d.category}</td>
                        <td className="fw-600">{d.product}</td>
                        <td><span className="batch-badge">{d.batch}</span></td>
                        <td>{d.qty} {d.qty === 1 ? 'unit' : 'units'}</td>
                        <td>{d.reason}</td>
                        <td className="fw-600 negative-text">{formatMoney(d.lossValue)}</td>
                      </tr>
                    ))}
                    {scopedDamaged.length === 0 && (
                      <tr>
                        <td colSpan={isAllBranches ? 9 : 8} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                          No damaged items recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <ComingSoon
              feature="Reports & Analytics"
              description="Branch-level and consolidated financial reporting and analytical exports will be available in the upcoming release."
            />
          )}

          {activeTab === 'audit' && <AuditLogPanel logs={auditLogs} />}

          {activeTab === 'accounts' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Account Provision</h2>
                  <p className="page-desc">The Owner creates and manages staff accounts: Pharmacist, Cashier, and Purchase Officer.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setEditingAccount({})}>
                  <UserPlus size={16} /> Create Account
                </button>
              </div>

              {accountNotice && (
                <div className={`success-notice ${accountNotice.type}`}>
                  {accountNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{accountNotice.text}</span>
                  <button type="button" onClick={() => setAccountNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Accounts</span>
                    <div className="stat-icon-wrapper cyan">
                      <UserCog size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{accounts.length}</div>
                  <div className="stat-chip neutral">Staff logins</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Active</span>
                    <div className="stat-icon-wrapper teal">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{accounts.filter((a) => a.status === 'Active').length}</div>
                  <div className="stat-chip positive">Can sign in</div>
                </div>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Inactive</span>
                    <div className="stat-icon-wrapper danger">
                      <Power size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{accounts.filter((a) => a.status === 'Inactive').length}</div>
                  <div className="stat-chip negative">Sign-in blocked</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, index) => {
                      const own = isOwnAccount(a)
                      const locked = own || a.role === 'Owner'
                      const lockReason = a.role === 'Owner' ? 'The Owner account' : 'Your own account'
                      const isActive = a.status === 'Active'
                      return (
                        <tr key={a.id}>
                          <td>{index + 1}</td>
                          <td className="fw-600 nowrap">
                            {a.fullName}
                            {own && <span className="current-chip">You</span>}
                          </td>
                          <td>{a.email}</td>
                          <td className="nowrap"><span className={`role-tag role-${(a.role || 'Pharmacist').toLowerCase().replace(' ', '-')}`}>{a.role || 'Pharmacist'}</span></td>
                          <td>{a.branchId === 'all' ? <span className="branch-tag"><Building2 size={12} /> All Branches</span> : <BranchTag branch={branchById(a.branchId)} />}</td>
                          <td><StatusTag status={a.status} /></td>
                          <td className="nowrap">{a.createdAt}</td>
                          <td>
                            <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                              <button type="button" className="icon-btn" onClick={() => setEditingAccount(a)} aria-label={`Edit ${a.fullName}`} title="Edit">
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className={`icon-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}`}
                                onClick={() => handleToggleAccountStatus(a)}
                                disabled={locked}
                                aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${a.fullName}`}
                                title={locked ? `${lockReason} can't be deactivated` : isActive ? 'Deactivate' : 'Activate'}
                              >
                                <Power size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-danger-btn"
                                onClick={() => handleDeleteAccount(a)}
                                disabled={locked}
                                aria-label={`Delete ${a.fullName}`}
                                title={locked ? `${lockReason} can't be deleted` : 'Delete'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {accounts.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                          No accounts yet. Click Create Account to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <SessionsPanel
                sessions={sessions}
                accounts={accounts}
                branchById={branchById}
                now={now}
                onEnd={handleEndSession}
                onEndIdle={handleEndIdleSessions}
                onSignOut={onLogout}
              />
            </div>
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

          {(activeTab === 'settings' || activeTab === 'policy') && (
            <SettingsPanel settings={settings} onSave={handleSaveSettings} />
          )}
        </div>
      </main>

      {editingInventory && (
        <EditInventoryModal
          item={editingInventory}
          branchName={branchById(editingInventory.branchId)?.name}
          onClose={() => setEditingInventory(null)}
          onSave={handleEditInventory}
        />
      )}

      {showAddMedicine && (
        <AddMedicineModal
          products={products}
          categories={categories}
          formatMoney={formatMoney}
          onClose={() => setShowAddMedicine(false)}
          onSave={handleSaveMedicine}
        />
      )}

      {editingAccount && (
        <AccountModal
          account={editingAccount}
          accounts={accounts}
          branches={branches}
          onClose={() => setEditingAccount(null)}
          onSave={handleSaveAccount}
        />
      )}

      {showSupplierReturn && (
        <SupplierReturnModal
          purchases={purchases}
          returnedQty={returnedQtyForPurchase}
          inventory={inventory}
          products={products}
          branchById={branchById}
          formatMoney={formatMoney}
          onClose={() => setShowSupplierReturn(false)}
          onSave={handleSupplierReturn}
        />
      )}

      {showRecordReturn && (
        <CustomerReturnModal
          sales={sales}
          returnedQty={returnedQtyForSale}
          branchById={branchById}
          formatMoney={formatMoney}
          onClose={() => setShowRecordReturn(false)}
          onSave={handleRecordReturn}
        />
      )}

      {showRecordDamage && (
        <RecordDamageModal
          branches={branches}
          inventory={inventory}
          categories={categories}
          formatMoney={formatMoney}
          onClose={() => setShowRecordDamage(false)}
          onSave={handleRecordDamage}
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
