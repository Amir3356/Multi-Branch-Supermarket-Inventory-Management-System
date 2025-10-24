// A staff account, as the API sends it (server: Accounts/Resources/AccountResource.php)

/**
 * @typedef {'owner' | 'pharmacist' | 'cashier' | 'purchase_officer'} Role
 * @typedef {'Pending' | 'Active' | 'Inactive'} AccountStatus
 *
 * @typedef {object} Account
 * @property {number} id
 * @property {string} fullName
 * @property {string} email
 * @property {Role} role
 * @property {string} roleLabel           e.g. "Procurement Officer"
 * @property {string} branchId            'all' for the Owner
 * @property {string} branchName          'All Branches' for the Owner
 * @property {AccountStatus} status       Pending until the invitation is accepted
 * @property {boolean} [invitationExpired] only for Pending accounts
 * @property {string | null} lastLoginAt  ISO timestamp
 * @property {string} createdAt           YYYY-MM-DD
 *
 * Sent to POST /accounts (new account: always invited) and PATCH /accounts/{id} (any subset)
 * @typedef {object} AccountPayload
 * @property {string} [fullName]
 * @property {string} [email]
 * @property {Role} [role]
 * @property {string} [branchId]
 * @property {'Active' | 'Inactive'} [status] only for accounts that accepted their invitation
 */

// Roles the Owner can give to staff accounts, with what each may open; each works at one branch.
// The Owner account itself is not created here: it covers all branches and manages these accounts.
export const ACCOUNT_ROLES = {
  pharmacist: { label: 'Pharmacist (Inventory Officer)', hint: 'Dashboard, inventory, stock transfers, damaged items, policy and reports' },
  cashier: { label: 'Cashier', hint: 'Sales, customer returns and reports' },
  purchase_officer: { label: 'Procurement Officer', hint: 'Procurement, supplier returns and reports' }
}

export const EMPTY_ACCOUNT_FORM = { fullName: '', email: '', role: '', branchId: '', status: 'Active' }

/** The form filled in from an existing account */
export const accountToForm = (account) => ({ fullName: account.fullName, email: account.email, role: account.role, branchId: account.branchId, status: account.status })

/** @returns {AccountPayload} the form's values, cleaned up; `email` is already trimmed and lower-cased */
export const toAccountPayload = (form, email) => ({ fullName: form.fullName.trim(), email, role: form.role, branchId: form.branchId, status: form.status })

/** @returns {AccountPayload} what an edit sends: status only once the invitation was accepted */
export const toAccountChanges = (existing, data) => {
  const changes = { fullName: data.fullName, email: data.email, role: data.role, branchId: data.branchId }
  if (existing.status !== 'Pending') changes.status = data.status
  return changes
}
