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

/** "Oct 11, 2026" and "14:32" in this computer's time */
export const auditDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const auditTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
