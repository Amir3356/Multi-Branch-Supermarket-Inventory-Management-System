import { api } from '../../api/http'

// Access review reports (Owner only). Plain API helpers: the reports are only used on this page.
export const fetchAccessReviews = () => api('/access-reviews').then((r) => r.data)
export const fetchAccessReview = (id) => api(`/access-reviews/${id}`).then((r) => r.data)
export const deleteAccessReview = (id) => api(`/access-reviews/${id}`, { method: 'DELETE' })
// period: daily | weekly | monthly | quarterly | yearly (the current period so far), or custom with from/to (YYYY-MM-DD)
// scope: 'current' = this period so far (Partial), 'previous' = the last finished one (Complete)
export const generateAccessReview = (period, from, to, scope = 'current') =>
  api('/access-reviews', { method: 'POST', body: period === 'custom' ? { period, from, to } : { period, scope } })

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

// The dates a report would cover if generated now (weeks start on Monday): the current period so far,
// or the previous finished one. Matches the server's calculation.
export const periodRange = (period, scope = 'current', now = new Date()) => {
  const key = (d) => d.toLocaleDateString('en-CA')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(today)
  if (period === 'weekly') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  if (period === 'monthly') start.setDate(1)
  if (period === 'quarterly') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1)
  if (period === 'yearly') start.setMonth(0, 1)
  if (scope === 'current') return { periodStart: key(start), periodEnd: key(today) }

  // Previous: step back one period from the current period's start; it ends the day before that start
  const end = new Date(start)
  end.setDate(end.getDate() - 1)
  const prevStart = new Date(start)
  if (period === 'daily') prevStart.setDate(prevStart.getDate() - 1)
  if (period === 'weekly') prevStart.setDate(prevStart.getDate() - 7)
  if (period === 'monthly') prevStart.setMonth(prevStart.getMonth() - 1)
  if (period === 'quarterly') prevStart.setMonth(prevStart.getMonth() - 3)
  if (period === 'yearly') prevStart.setFullYear(prevStart.getFullYear() - 1)
  return { periodStart: key(prevStart), periodEnd: key(end) }
}

// Last day the report's period runs to: daily → that day, weekly → Sunday, monthly/quarterly/yearly →
// the last day of the month/quarter/year, custom → its end date
const periodLastDay = (review) => {
  const start = new Date(`${review.periodStart}T00:00:00`)
  switch (review.periodType) {
    case 'daily': return start
    case 'weekly': return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    case 'monthly': return new Date(start.getFullYear(), start.getMonth() + 1, 0)
    case 'quarterly': return new Date(start.getFullYear(), start.getMonth() + 3, 0)
    case 'yearly': return new Date(start.getFullYear(), 11, 31)
    default: return new Date(`${review.periodEnd}T00:00:00`)
  }
}

/**
 * Complete when the report was made after its whole period ended; Partial when it was made while the
 * period was still running (it only covers up to the moment it was generated).
 */
export const reportStatus = (review) => {
  const endOfPeriod = periodLastDay(review)
  endOfPeriod.setHours(23, 59, 59, 999)
  return new Date(review.generatedAt) > endOfPeriod ? 'Complete' : 'Partial'
}

export const formatPeriod = (review) => {
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return review.periodStart === review.periodEnd ? fmt(review.periodStart) : `${fmt(review.periodStart)} – ${fmt(review.periodEnd)}`
}

// A timestamp's date in this computer's local time, e.g. 2026-10-08
export const localDate = (iso) => new Date(iso).toLocaleDateString('en-CA')

const pdfDate = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

// Printable, read-only copy of a report for management sign-off and auditors (landscape A4)
export async function exportAccessReviewPdf(review, pharmacyName = 'PharmaCare') {
  // Loaded only when someone exports, so pages stay light
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const s = review.summary
  const pageWidth = doc.internal.pageSize.getWidth()
  const typeLabel = PERIOD_TYPES[review.periodType]?.label || review.periodType

  doc.setFont('helvetica', 'bold').setFontSize(16).text(`${pharmacyName} - Access Review`, 40, 44)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90)
  const status = reportStatus(review) === 'Complete' ? 'Complete' : `Partial (covers up to ${pdfDate(review.generatedAt)})`
  doc.text(`Period: ${typeLabel} · ${formatPeriod(review)} · Status: ${status}`, 40, 64)
  doc.text(`Generated ${pdfDate(review.generatedAt)} by ${review.scheduled ? 'the schedule' : review.generatedBy || 'the Owner'} · Dormant = no sign-in for ${s.dormantDays}+ days`, 40, 78)
  doc.setTextColor(0)

  // Summary
  autoTable(doc, {
    startY: 92,
    head: [['Accounts', ...Object.keys(s.byRole), 'Dormant', 'Role changed', 'Invitation not accepted', 'Deactivated']],
    body: [[s.totalUsers, ...Object.values(s.byRole), s.dormant, s.roleChanged, s.staleInvitations, s.deactivated]],
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center' },
    headStyles: { fillColor: [8, 145, 178] }
  })

  // Every account
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [['Staff member', 'Email', 'Role', 'Branch', 'Status', 'Created', 'Last sign-in', 'Days', 'Role changes in period']],
    body: review.rows.map((r) => [
      r.fullName,
      r.email,
      r.roleLabel,
      r.branchName || '-',
      r.status,
      r.createdAt,
      r.lastLoginAt ? localDate(r.lastLoginAt) : 'Never',
      r.daysSinceLogin ?? '-',
      r.roleChanges.map((c) => `${c.from} -> ${c.to} (${localDate(c.at)})`).join('\n') || '-'
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
    headStyles: { fillColor: [8, 145, 178] }
  })

  // Review record, or blank lines to sign a printed copy
  let y = doc.lastAutoTable.finalY + 28
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage()
    y = 50
  }
  doc.setFont('helvetica', 'bold').setFontSize(11).text('Review', 40, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  if (review.reviewedAt) {
    doc.text(`Reviewed by ${review.reviewedBy} on ${pdfDate(review.reviewedAt)}`, 40, y + 18)
    if (review.reviewNote) doc.text(doc.splitTextToSize(`Note: ${review.reviewNote}`, pageWidth - 80), 40, y + 34)
  } else {
    doc.text('Reviewed by: ______________________     Signature: ______________________     Date: ______________', 40, y + 22)
  }

  // Page numbers
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setFontSize(8).setTextColor(130)
    doc.text(`Page ${page} of ${pages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  doc.save(`access-review-${review.periodType}-${review.periodStart}-to-${review.periodEnd}.pdf`)
}
