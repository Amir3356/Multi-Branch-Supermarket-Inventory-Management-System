import { api } from '../../api/http'

// Access review reports (Owner only). Plain API helpers: the reports are only used on this page.
export const fetchAccessReviews = () => api('/access-reviews').then((r) => r.data)
export const fetchAccessReview = (id) => api(`/access-reviews/${id}`).then((r) => r.data)
// period: daily | weekly | quarterly | yearly (so far), or custom with from/to (YYYY-MM-DD)
export const generateAccessReview = (period, from, to) =>
  api('/access-reviews', { method: 'POST', body: period === 'custom' ? { period, from, to } : { period } })

export const PERIOD_TYPES = {
  daily: { label: 'Daily', generate: 'Today' },
  weekly: { label: 'Weekly', generate: 'This week (Monday to today)' },
  quarterly: { label: 'Quarterly', generate: 'This quarter so far' },
  yearly: { label: 'Yearly', generate: 'This year so far' },
  custom: { label: 'Custom', generate: 'Custom date range' }
}
export const markAccessReviewed = (id, note) => api(`/access-reviews/${id}/review`, { method: 'POST', body: { note } })

// What each flag means, and the status-tag colour it uses
export const REVIEW_FLAGS = {
  dormant: { label: 'Dormant', tone: 'out-of-stock', hint: 'Active, but no sign-in for a long time' },
  role_changed: { label: 'Role changed', tone: 'low-stock', hint: 'Role changed during this period: check the new access is still needed' },
  stale_invitation: { label: 'Invitation not accepted', tone: 'low-stock', hint: 'Invited long ago and never set up' },
  deactivated: { label: 'Deactivated', tone: 'inactive', hint: 'Blocked, but still on file: consider deleting' }
}

export const formatPeriod = (review) => {
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return review.periodStart === review.periodEnd ? fmt(review.periodStart) : `${fmt(review.periodStart)} – ${fmt(review.periodEnd)}`
}

// Spreadsheet-friendly copy of a report, for records or auditors
export function downloadAccessReviewCsv(review) {
  const header = ['Full name', 'Email', 'Role', 'Branch', 'Status', 'Created', 'Last login', 'Days since login', 'Role changes', 'Flags']
  const rows = review.rows.map((r) => [
    r.fullName,
    r.email,
    r.roleLabel,
    r.branchName || '',
    r.status,
    r.createdAt,
    r.lastLoginAt ? r.lastLoginAt.slice(0, 10) : 'Never',
    r.daysSinceLogin ?? '',
    r.roleChanges.map((c) => `${c.from} -> ${c.to} (${c.at.slice(0, 10)})`).join('; '),
    r.flags.map((f) => REVIEW_FLAGS[f]?.label || f).join('; ')
  ])
  const csv = [header, ...rows].map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `access-review-${review.periodStart}-to-${review.periodEnd}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
