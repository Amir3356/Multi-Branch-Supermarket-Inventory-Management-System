// An audit log entry, as the API sends it (server: AuditLogs/Resources/AuditLogResource.php)

/**
 * @typedef {object} AuditLog
 * @property {number} id
 * @property {string} occurredAt       ISO timestamp
 * @property {string | null} userName  who did it (or the email typed in, for a failed sign-in; "Chapa" for payments it confirmed)
 * @property {string | null} userRole  e.g. "Cashier"
 * @property {string | null} branchId  the branch the action concerns
 * @property {string | null} branchName
 * @property {string} module           e.g. "Sales"
 * @property {string} action           e.g. "Sale recorded"
 * @property {string | null} recordId  e.g. "SL-00012"
 * @property {string} description
 * @property {string | null} ipAddress
 * @property {string | null} device    e.g. "Chrome on Windows"
 *
 * @typedef {{ data: AuditLog[], meta: { current_page: number, last_page: number, total: number, from: number | null, to: number | null }, modules: string[] }} AuditLogPage
 */

/** "Oct 11, 2026" and "2:32 PM" in this computer's time */
export const auditDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const auditTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

// What kind of action it was, in one word for the Action column; the full action stays in the Description
const VERBS = {
  'Stock added': 'Received',
  'Transfer received': 'Received',
  'Payment confirmed': 'Paid',
  'Payment failed': 'Payment failed',
  'Invitation accepted': 'Accepted',
  'Invitation resent': 'Resent',
  'Session ended': 'Ended',
  'Signed out (inactive)': 'Signed out',
  'Password reset requested': 'Reset requested',
  'Account deactivated': 'Edited',
  'Account activated': 'Edited',
  'Role changed': 'Edited'
}

/** "Created", "Edited", "Deleted", "Received", "Signed in"… from a recorded action such as "Branch added" */
export const actionVerb = (action) => {
  if (VERBS[action]) return VERBS[action]
  if (/\b(deleted|removed)\b/i.test(action)) return 'Deleted'
  if (/\b(updated|changed|corrected|regenerated)\b/i.test(action)) return 'Edited'
  if (/\b(added|invited|recorded|created|generated|sent)\b/i.test(action)) return 'Created'
  return action
}

/** Colour for the Action badge: what was made, changed, removed, or anything else */
export const actionTone = (verb) => ({ Created: 'created', Edited: 'edited', Deleted: 'deleted' })[verb] || 'other'
