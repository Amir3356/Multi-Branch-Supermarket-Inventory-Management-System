import { useState } from 'react'
import {
  X,
  Save,
  UserCog,
  UserPlus
} from 'lucide-react'
import { useEscapeKey } from '../../hooks'

// Roles the Owner can give to staff accounts; each works at one branch.
// The Owner account itself is not created here: it covers all branches and manages these accounts.
const ACCOUNT_ROLES = {
  Pharmacist: 'Inventory Officer: manages inventory, stock levels, transfers, damaged items',
  Cashier: 'Records sales and customer returns',
  'Purchase Officer': 'Creates purchases and supplier returns'
}

const EMPTY_ACCOUNT_FORM = { fullName: '', email: '', role: '', branchId: '', status: 'Active' }

// Create or edit a staff login account
export default function AccountModal({ account, accounts, branches, onClose, onSave }) {
  const isEdit = Boolean(account?.id)
  const isOwner = account?.role === 'Owner'
  const [form, setForm] = useState(
    isEdit
      ? { fullName: account.fullName, email: account.email, role: account.role || 'Pharmacist', branchId: account.branchId, status: account.status }
      : EMPTY_ACCOUNT_FORM
  )
  const [errors, setErrors] = useState({})

  useEscapeKey(onClose)

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
