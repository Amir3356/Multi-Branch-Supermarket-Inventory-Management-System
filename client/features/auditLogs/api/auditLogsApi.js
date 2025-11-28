import { api } from '../../../api/http'

// The Owner's audit log: read only, filtered and paged by the server
export const AUDIT_LOGS_ENDPOINTS = { list: '/audit-logs' }

/** One page of entries, newest first. `filters`: { from, to, module, branchId, search, page }; empty ones are left out */
export const fetchAuditLogs = (filters) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null && value !== 'all'))
  return api(`${AUDIT_LOGS_ENDPOINTS.list}?${query}`)
}
