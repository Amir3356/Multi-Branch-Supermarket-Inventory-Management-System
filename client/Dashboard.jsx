import { useState, useEffect, useMemo } from 'react'
import {
  useTable,
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  filterFn_equalsString,
  sortFn_text,
  sortFn_basic
} from '@tanstack/react-table'
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
  MapPin,
  Phone,
  Users,
  X,
  Save,
  Landmark,
  Trash2,
  Pencil,
  ShieldCheck,
  Bell,
  CheckCheck,
  Mail,
  MailOpen,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
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

const STATUS_TONE = {
  'In Stock': 'in-stock',
  'Low Stock': 'low-stock',
  'Expiring Soon': 'expiring-soon',
  'Paid': 'in-stock',
  'Cleared': 'in-stock',
  'Received': 'in-stock',
  'Active': 'in-stock',
  'Pending Approval': 'low-stock',
  'In Transit': 'in-transit',
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
  transferApproval: true,
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
  `${CURRENCIES[currency]?.symbol || '$'}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Status is derived from each branch's own stock level and batch expiry, using the configured rules
const getStockStatus = (stock, reorderLevel, expiry, settings) => {
  if (settings.lowStockAlerts && stock < reorderLevel) return 'Low Stock'
  const daysToExpiry = (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24)
  if (settings.expiryAlerts && daysToExpiry <= settings.expiryWarningDays) return 'Expiring Soon'
  return 'In Stock'
}

// Inventory rows: one row per medicine per branch
const buildInventory = (settings) =>
  BRANCH_STOCK.map((entry) => {
    const med = MEDICINES.find((m) => m.id === entry.medId)
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

const EMPTY_BRANCH_FORM = { name: '', code: '', location: '', phone: '', staff: '', status: 'Active' }

function AddBranchModal({ branches, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_BRANCH_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const updateField = (field) => (e) => {
    const value = field === 'code' ? e.target.value.toUpperCase() : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = 'Branch name is required'
    else if (branches.some((b) => b.name.toLowerCase() === form.name.trim().toLowerCase())) newErrors.name = 'A branch with this name already exists'

    if (!form.code.trim()) newErrors.code = 'Branch code is required'
    else if (!/^[A-Z0-9]{2,4}$/.test(form.code.trim())) newErrors.code = 'Use 2–4 letters or numbers'
    else if (branches.some((b) => b.code === form.code.trim())) newErrors.code = 'This code is already in use'

    if (!form.location.trim()) newErrors.location = 'Location is required'

    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    else if (!/^\+?[\d\s-]{7,}$/.test(form.phone.trim())) newErrors.phone = 'Enter a valid phone number'

    if (form.staff !== '' && (!Number.isInteger(Number(form.staff)) || Number(form.staff) < 0)) newErrors.staff = 'Enter a whole number'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      name: form.name.trim(),
      code: form.code.trim(),
      location: form.location.trim(),
      phone: form.phone.trim(),
      staff: Number(form.staff) || 0,
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
              <h2 id="add-branch-title">Add New Branch</h2>
              <p className="page-desc">Register a new pharmacy location in the network.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          <div className="modal-section-title">Branch Details</div>
          <div className="modal-grid">
            {field('name', 'Branch Name *', 'e.g. Northside Branch', { autoFocus: true })}
            {field('code', 'Branch Code *', 'e.g. NS', { maxLength: 4 })}
          </div>
          {field('location', 'Location / Address *', 'Street, area, city')}

          <div className="modal-section-title">Contact & Pharmacists</div>
          <div className="modal-grid">
            {field('phone', 'Phone Number *', '+251 9xx xxx xxx', { type: 'tel' })}
            {field('staff', 'Number of Pharmacists', '0', { type: 'number', min: 0 })}
          </div>
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
              <Plus size={16} /> Create Branch
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
  transfer: { label: 'Transfers', icon: ArrowLeftRight, tone: 'cyan' },
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
          <p className="page-desc">Stock alerts, transfer requests, and government tax reminders that need your attention.</p>
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

// TanStack Table setup for the Inventory page (features are module-level so they stay stable)
const inventoryTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
  sortFns: { text: sortFn_text, basic: sortFn_basic }
})

const INVENTORY_CATEGORIES = [...new Set(MEDICINES.map((m) => m.category))].sort()

const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Expiring Soon']

const INVENTORY_SORTS = {
  'name-asc': { label: 'Name (A–Z)', sorting: [{ id: 'name', desc: false }] },
  'name-desc': { label: 'Name (Z–A)', sorting: [{ id: 'name', desc: true }] },
  'stock-asc': { label: 'Stock (low to high)', sorting: [{ id: 'stock', desc: false }] },
  'stock-desc': { label: 'Stock (high to low)', sorting: [{ id: 'stock', desc: true }] },
  'expiry-asc': { label: 'Expiry (soonest first)', sorting: [{ id: 'expiry', desc: false }] },
  'price-desc': { label: 'Selling price (high to low)', sorting: [{ id: 'sellingPrice', desc: true }] }
}

const INVENTORY_PAGE_SIZES = [5, 10, 20, 50]

const INVENTORY_DEFAULT_SORTING = INVENTORY_SORTS['name-asc'].sorting

// Search matches the medicine name, SKU code, or batch number
const inventorySearchFn = (row, _columnId, value) => {
  const query = String(value).trim().toLowerCase()
  const { name, id, batch } = row.original
  return [name, id, batch].some((field) => field.toLowerCase().includes(query))
}

function InventoryTable({ data, branches, showBranch, formatMoney }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [sorting, setSorting] = useState(INVENTORY_DEFAULT_SORTING)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

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
      { accessorKey: 'sellingPrice', header: 'Sells Price', sortFn: 'basic', cell: (info) => formatMoney(info.getValue()) },
      { accessorKey: 'batch', header: 'Batch Number', sortFn: 'text', cell: (info) => <span className="batch-badge">{info.getValue()}</span> },
      { accessorKey: 'expiry', header: 'Expiration Date', sortFn: 'text' },
      { accessorKey: 'status', header: 'Status', filterFn: 'equalsString', sortFn: 'text', cell: (info) => <StatusTag status={info.getValue()} /> }
    ]
  }, [branches, showBranch, formatMoney])

  // The branch filter only applies while the Branch column is shown
  const activeColumnFilters = showBranch ? columnFilters : columnFilters.filter((f) => f.id !== 'branchId')

  const table = useTable({
    features: inventoryTableFeatures,
    columns,
    data,
    state: { globalFilter, columnFilters: activeColumnFilters, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: inventorySearchFn,
    getColumnCanGlobalFilter: (column) => column.id === 'name'
  })

  const resetPage = () => setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  const filterValue = (id) => activeColumnFilters.find((f) => f.id === id)?.value ?? 'all'
  const setFilter = (id, value) => {
    table.getColumn(id)?.setFilterValue(value === 'all' ? undefined : value)
    resetPage()
  }

  const sortKey = Object.keys(INVENTORY_SORTS).find((key) => JSON.stringify(INVENTORY_SORTS[key].sorting) === JSON.stringify(sorting)) ?? (sorting.length ? 'custom' : 'none')
  const filtersActive = Boolean(globalFilter) || activeColumnFilters.length > 0 || sortKey !== 'name-asc'

  const clearFilters = () => {
    setGlobalFilter('')
    setColumnFilters([])
    setSorting(INVENTORY_DEFAULT_SORTING)
    resetPage()
  }

  const matchingCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = pagination
  const firstShown = matchingCount ? pageIndex * pageSize + 1 : 0
  const lastShown = Math.min((pageIndex + 1) * pageSize, matchingCount)
  const pageCount = Math.max(1, table.getPageCount())
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
              resetPage()
            }}
          />
        </div>

        <select className="input-field filter-select" aria-label="Filter by category" value={filterValue('category')} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="all">All Categories</option>
          {INVENTORY_CATEGORIES.map((c) => (
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

        <select
          className="input-field filter-select"
          aria-label="Sort by"
          value={sortKey}
          onChange={(e) => {
            setSorting(e.target.value === 'none' ? [] : INVENTORY_SORTS[e.target.value].sorting)
            resetPage()
          }}
        >
          <option value="none">Sort: Default order</option>
          {Object.entries(INVENTORY_SORTS).map(([key, opt]) => (
            <option key={key} value={key}>Sort: {opt.label}</option>
          ))}
          {sortKey === 'custom' && <option value="custom" disabled>Sort: By column header</option>}
        </select>
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
                <td>{pageIndex * pageSize + index + 1}</td>
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

      {/* Pagination */}
      <div className="table-pagination">
        <span className="pagination-info">
          Showing {firstShown}–{lastShown} of {matchingCount}
        </span>

        <div className="pagination-controls">
          <label className="page-size">
            Rows per page
            <select className="input-field" value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>
              {INVENTORY_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <span className="pagination-info">Page {Math.min(pageIndex + 1, pageCount)} of {pageCount}</span>

          <div className="pagination-buttons">
            <button type="button" className="icon-btn" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()} aria-label="First page" title="First page">
              <ChevronsLeft size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page" title="Previous page">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page" title="Next page">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()} aria-label="Last page" title="Last page">
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [selectedBranch, setSelectedBranch] = useState(() =>
    INITIAL_BRANCHES.some((b) => b.id === settings.defaultBranch) ? settings.defaultBranch : 'all'
  )
  const [branches, setBranches] = useState(INITIAL_BRANCHES)
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [branchNotice, setBranchNotice] = useState(null)

  const branchById = (id) => branches.find((b) => b.id === id)
  const formatMoney = (value) => formatMoneyIn(settings.currency, value)
  const inventory = buildInventory(settings)
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
    setBranchNotice(`${newBranch.name} (${newBranch.id}) was added successfully.`)
  }

  const isAllBranches = selectedBranch === 'all'
  const currentBranch = branchById(selectedBranch)
  const scopeLabel = isAllBranches ? 'All Branches' : currentBranch.name
  const inScope = (branchId) => isAllBranches || branchId === selectedBranch
  const query = searchQuery.toLowerCase()

  // Branch-scoped data
  const visibleBranches = branches.filter((b) => inScope(b.id))
  const scopedInventory = inventory.filter((item) => inScope(item.branchId))
  const filteredInventory = scopedInventory.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.batch.toLowerCase().includes(query)
  )
  const scopedSales = SALES.filter((s) => inScope(s.branchId))
  const scopedPurchases = PURCHASES.filter((p) => inScope(p.branchId))
  const scopedPayments = PAYMENTS.filter((p) => inScope(p.branchId))
  const scopedTransfers = TRANSFERS.filter((t) => inScope(t.from) || inScope(t.to))

  // Aggregated metrics for the selected scope
  const totalRevenue = visibleBranches.reduce((sum, b) => sum + b.revenue, 0)
  const totalExpenses = visibleBranches.reduce((sum, b) => sum + b.expenses, 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0
  const lowStockCount = scopedInventory.filter((i) => i.status === 'Low Stock').length
  const expiringCount = scopedInventory.filter((i) => i.status === 'Expiring Soon').length
  const salesTotal = scopedSales.reduce((sum, s) => sum + s.total, 0)
  const pendingTransfers = scopedTransfers.filter((t) => t.status !== 'Received').length

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
    ...scopedTransfers
      .filter((t) => t.status !== 'Received')
      .map((t) => ({
        id: `trf-${t.id}-${t.status}`,
        type: 'transfer',
        tab: 'transfers',
        branch: branchById(isAllBranches || t.to === selectedBranch ? t.to : t.from),
        title: t.status === 'Pending Approval' ? `Transfer ${t.id} awaiting approval` : `Transfer ${t.id} in transit`,
        message: `${t.qty} units of ${t.product} from ${branchById(t.from)?.name} to ${branchById(t.to)?.name}, requested by ${t.requestedBy}.`,
        meta: `Requested ${formatDate(new Date(t.date))}`,
        sort: 2
      })),
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

  const openBranch = (branchId) => {
    setSelectedBranch(branchId)
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
          {navItem('overview', LayoutDashboard, 'Overview')}
          {navItem('inventory', Package, 'Inventory', lowStockCount + expiringCount)}
          {navItem('sales', ShoppingCart, 'Sales')}
          {navItem('notifications', Bell, 'Notifications', unreadNotifications)}

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>OPERATIONS</div>
          {navItem('orders', PackageCheck, 'Purchase')}
          {navItem('transfers', ArrowLeftRight, 'Stock Transfers', pendingTransfers)}

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
        <header className="dashboard-header">
          <div className="header-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search medicines, batches, SKU codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        {/* Dynamic Views */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <>
              <div className="content-title-row">
                <div>
                  <h1 className="page-title">{isAllBranches ? 'Network Overview' : `${currentBranch.name} Overview`}</h1>
                  <p className="page-desc">
                    {isAllBranches
                      ? 'Consolidated stock, financials, and alerts across every pharmacy branch.'
                      : `Real-time stock, financials, and alerts for ${currentBranch.name} · ${currentBranch.location}.`}
                  </p>
                </div>
                <button className="primary-action-btn" onClick={() => setActiveTab('inventory')}>
                  <Plus size={16} /> Add New Batch
                </button>
              </div>

              {/* Metric Stat Cards: Financials (Revenue, Expense, Profit) + Stock Status */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{formatMoney(totalRevenue)}</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> {scopeLabel}
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
                  <div className="stat-value">{lowStockCount + expiringCount} Items</div>
                  <div className="stat-chip negative">
                    {lowStockCount} low · {expiringCount} expiring
                  </div>
                </div>
              </div>

              {/* Branch Performance Comparison (network view only) */}
              {isAllBranches && (
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

              {/* Inventory Alerts Preview */}
              <div className="content-section-card" style={{ marginTop: '1.5rem' }}>
                <div className="section-header">
                  <h3>Stock Requiring Attention</h3>
                  <button className="link-btn" onClick={() => setActiveTab('inventory')}>
                    View All <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        {isAllBranches && <th>Branch</th>}
                        <th>Category</th>
                        <th>Stock Level</th>
                        <th>Reorder Level</th>
                        <th>Batch No.</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory
                        .filter((item) => item.status !== 'In Stock')
                        .map((item) => (
                          <tr key={item.key}>
                            <td className="fw-600">{item.name}</td>
                            {isAllBranches && <td><BranchTag branch={branchById(item.branchId)} /></td>}
                            <td>{item.category}</td>
                            <td>{item.stock} units</td>
                            <td>{item.reorderLevel} units</td>
                            <td><span className="batch-badge">{item.batch}</span></td>
                            <td>{item.expiry}</td>
                            <td><StatusTag status={item.status} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
                  <button className="primary-action-btn">
                    <Plus size={16} /> Add Medicine
                  </button>
                </div>
              </div>

              <InventoryTable
                data={filteredInventory}
                branches={branches}
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
                <button className="primary-action-btn" disabled={isAllBranches} title={isAllBranches ? 'Select a branch to record a sale' : undefined}>
                  <Plus size={16} /> New Sale Transaction
                </button>
              </div>

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
                    <span className="stat-title">Completed Orders</span>
                    <div className="stat-icon-wrapper cyan">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedSales.length}</div>
                  <div className="stat-chip neutral">
                    <CheckCircle2 size={12} /> Processed
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
                <button className="primary-action-btn">
                  <Plus size={16} /> Create Purchase
                </button>
              </div>

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
                <button className="primary-action-btn">
                  <Plus size={16} /> New Transfer Request
                </button>
              </div>

              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Pending / In Transit</span>
                    <div className="stat-icon-wrapper warning">
                      <ArrowLeftRight size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{pendingTransfers}</div>
                  <div className="stat-chip negative">Awaiting approval or receipt</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Completed Transfers</span>
                    <div className="stat-icon-wrapper teal">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <div className="stat-value">{scopedTransfers.length - pendingTransfers}</div>
                  <div className="stat-chip positive">Received at destination</div>
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
                  <p className="page-desc">Manage pharmacy locations, contact details, and pharmacists across the network.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setShowAddBranch(true)}>
                  <Plus size={16} /> Add Branch
                </button>
              </div>

              {branchNotice && (
                <div className="success-notice">
                  <CheckCircle2 size={16} />
                  <span>{branchNotice}</span>
                  <button type="button" onClick={() => setBranchNotice(null)} aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="branch-grid">
                {branches.map((b) => {
                  const summary = branchSummary(b.id)
                  return (
                    <div key={b.id} className={`branch-card ${selectedBranch === b.id ? 'selected' : ''}`}>
                      <div className="branch-card-head">
                        <div>
                          <h3>{b.name}</h3>
                          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{b.id} · {b.code}</span>
                        </div>
                        <StatusTag status={b.status} />
                      </div>

                      <div className="branch-card-meta">
                        <span><MapPin size={14} /> {b.location}</span>
                        <span><Phone size={14} /> {b.phone}</span>
                        <span><Users size={14} /> {b.staff} {b.staff === 1 ? 'pharmacist' : 'pharmacists'}</span>
                      </div>

                      <div className="branch-card-stats">
                        <div>
                          <small>Revenue</small>
                          <strong>{formatMoney(b.revenue)}</strong>
                        </div>
                        <div>
                          <small>Units</small>
                          <strong>{summary.units.toLocaleString()}</strong>
                        </div>
                        <div>
                          <small>Alerts</small>
                          <strong style={{ color: summary.alerts ? '#f59e0b' : 'var(--primary-emerald)' }}>{summary.alerts}</strong>
                        </div>
                      </div>

                      <button className="secondary-action-btn" style={{ justifyContent: 'center' }} onClick={() => openBranch(b.id)}>
                        View Branch Dashboard <ArrowRight size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
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
            <PolicyPanel settings={settings} branchCount={branches.length} onSave={handleSaveSettings} />
          )}
        </div>
      </main>

      {showAddBranch && (
        <AddBranchModal
          branches={branches}
          onClose={() => setShowAddBranch(false)}
          onSave={handleAddBranch}
        />
      )}
    </div>
  )
}
