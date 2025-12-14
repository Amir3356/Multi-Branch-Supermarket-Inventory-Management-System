import { PERIOD_TYPES } from '../model/accessReview'
import { drawAccessReviewCharts } from './accessReviewPdfCharts'

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

// Last sign-in as of the report: a date, "Never", or "No record" when the account signed in at some point but the
// sign-in history doesn't reach back to this period
export const lastSignInText = (row, formatDate = localDate) =>
  row.lastLoginAt ? formatDate(row.lastLoginAt) : row.lastLoginKnown === false ? 'No record' : 'Never'

const pdfDate = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

// Printable, read-only copy of a report for management sign-off and auditors (landscape A4), downloaded as a file
export async function exportAccessReviewPdf(review, pharmacyName = 'PharmaCare') {
  // Loaded only when someone exports, so pages stay light
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  buildAccessReviewPdf(review, pharmacyName, { jsPDF, autoTable })
    .save(`user-report-${review.periodType}-${review.periodStart}-to-${review.periodEnd}.pdf`)
}

/** The report as a jsPDF document: the same figures, charts and table as the screen */
export function buildAccessReviewPdf(review, pharmacyName, { jsPDF, autoTable }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const s = review.summary
  const pageWidth = doc.internal.pageSize.getWidth()
  const typeLabel = PERIOD_TYPES[review.periodType]?.label || review.periodType

  doc.setFont('helvetica', 'bold').setFontSize(16).text(`${pharmacyName} - ${PERIOD_TYPES[review.periodType]?.label || ''} User Report`, 40, 44)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90)
  const status = reportStatus(review) === 'Complete' ? 'Complete' : `Partial (covers up to ${pdfDate(review.generatedAt)})`
  doc.text(`Period: ${typeLabel} · ${formatPeriod(review)} · Status: ${status}`, 40, 64)
  doc.text(`Generated ${pdfDate(review.generatedAt)} by ${review.scheduled ? 'the schedule' : review.generatedBy || 'the Owner'}`, 40, 78)
  doc.setTextColor(0)

  // Summary: the same figures as the chips on screen
  autoTable(doc, {
    startY: 92,
    head: [['Users', ...Object.keys(s.byRole), 'Dormant', 'Role changes', 'Invitation links expired', 'Deactivated on file']],
    body: [[s.totalUsers, ...Object.values(s.byRole), s.dormant, s.roleChanged, s.staleInvitations, s.deactivated]],
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center' },
    headStyles: { fillColor: [8, 145, 178] }
  })

  // The charts, as on screen
  const chartsEnd = drawAccessReviewCharts(doc, review, doc.lastAutoTable.finalY + 14)

  // Every account
  autoTable(doc, {
    startY: chartsEnd + 18,
    head: [['Staff member', 'Email', 'Role', 'Branch', 'Status', 'Created', 'Last sign-in', 'Role changes in period']],
    body: review.rows.map((r) => [
      r.fullName,
      r.email,
      r.roleLabel,
      r.branchName || '-',
      r.status,
      r.createdAt,
      // Date and time, as on screen
      lastSignInText(r, pdfDate),
      r.roleChanges.map((c) => `${c.from} -> ${c.to} (${localDate(c.at)})`).join('\n') || '-'
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
    headStyles: { fillColor: [8, 145, 178] }
  })


  // Page numbers
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setFontSize(8).setTextColor(130)
    doc.text(`Page ${page} of ${pages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  return doc
}
