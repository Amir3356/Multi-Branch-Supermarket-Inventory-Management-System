import { iso8601 } from '../utils/index.js'

/** An entry of the audit log (audit_logs, written only by this service) */
export const TABLE = 'audit_logs'

// The areas of the system an action can belong to, in the order the Owner's filter lists them
export const MODULES = Object.freeze([
  'Sign-in', 'Accounts', 'Branches', 'Sessions', 'User Report', 'Products', 'Policy', 'Procurement', 'Stock Transfers', 'Sales', 'Expenses', 'Damaged Items', 'Inventory',
])

/** Entries per page on the Owner's Audit Logs page */
export const PER_PAGE = 25

/** AuditLogResource */
export const toResource = (log) => ({
  id: log.id,
  occurredAt: iso8601(log.occurred_at),
  userName: log.user_name,
  userRole: log.user_role,
  branchId: log.branch_id,
  branchName: log.branch_name,
  module: log.module,
  action: log.action,
  recordId: log.record_id,
  description: log.description,
  ipAddress: log.ip_address,
  device: log.device,
})

/** The counts block: `since` as toIso8601String() of the oldest entry */
export const toCountsResource = (counts) => ({ total: counts.total, since: counts.since ? iso8601(counts.since) : null, today: counts.today, todayUsers: counts.todayUsers })
