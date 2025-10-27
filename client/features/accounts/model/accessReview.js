// An access review report, as the API sends it (server: AccessReviews/Resources/AccessReviewResource.php)

/**
 * @typedef {'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'} PeriodType
 *
 * @typedef {object} AccessReviewSummary
 * @property {number} totalUsers
 * @property {Record<string, number>} byRole    accounts per role label
 * @property {number} dormant
 * @property {number} roleChanged
 * @property {number} staleInvitations
 * @property {number} deactivated
 * @property {number} needsAttention
 * @property {number} dormantDays
 * @property {string} asOf                      ISO timestamp
 *
 * @typedef {object} AccessReviewRow
 * @property {number} userId
 * @property {string} fullName
 * @property {string} email
 * @property {string} role
 * @property {string} roleLabel
 * @property {string | null} branchName
 * @property {string} status
 * @property {string} createdAt                 YYYY-MM-DD
 * @property {string | null} lastLoginAt        last sign-in on or before the period's end (ISO timestamp)
 * @property {number | null} daysSinceLogin   counted to the end of the period (or to when the report was made)
 * @property {boolean} [lastLoginKnown]       false: signed in at some point, but the history doesn't show whether by then
 * @property {{ from: string, to: string, at: string }[]} roleChanges
 * @property {('dormant' | 'role_changed' | 'stale_invitation' | 'deactivated')[]} flags
 *
 * @typedef {object} AccessReview
 * @property {number} id
 * @property {string} periodStart               YYYY-MM-DD
 * @property {string} periodEnd                 YYYY-MM-DD
 * @property {PeriodType} periodType
 * @property {boolean} scheduled                made by the schedule rather than the Owner
 * @property {string} generatedAt               ISO timestamp
 * @property {string | null} generatedBy
 * @property {AccessReviewSummary} summary
 * @property {string | null} reviewedAt
 * @property {string | null} reviewedBy
 * @property {string | null} reviewNote
 * @property {AccessReviewRow[]} [rows]         only when one report is opened
 *
 * Sent to POST /access-reviews
 * @typedef {{ period: Exclude<PeriodType, 'custom'>, scope: 'current' | 'previous' } | { period: 'custom', from: string, to: string }} AccessReviewPayload
 */

// The two choices offered for each period type in the Generate dialog
export const SCOPE_LABELS = {
  daily: { current: 'Today so far', previous: 'Yesterday' },
  weekly: { current: 'This week so far', previous: 'Last week' },
  monthly: { current: 'This month so far', previous: 'Last month' },
  quarterly: { current: 'This quarter so far', previous: 'Last quarter' },
  yearly: { current: 'This year so far', previous: 'Last year' }
}

// label: the report's type in titles, the list and the PDF; option: its name in the Report period picker
export const PERIOD_TYPES = {
  daily: { label: 'Daily', option: 'Daily' },
  weekly: { label: 'Weekly', option: 'Weekly' },
  monthly: { label: 'Monthly', option: 'Monthly' },
  quarterly: { label: 'Quarterly', option: 'Quarterly' },
  yearly: { label: 'Yearly', option: 'Yearly' },
  custom: { label: 'Custom', option: 'Custom date range' }
}
