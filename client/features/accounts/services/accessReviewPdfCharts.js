import { unusedAccounts, usersByBranch, usersByRole, usersByStatus } from './accessReviewCharts'

// The access review's charts drawn into the PDF with jsPDF shapes, from the same figures as the screen
// (accessReviewCharts.js). The page is white, so colours are the palette's light-surface steps (validated); every
// slice and bar also carries its number and label, since two of them are under 3:1 contrast on white.
const TONES = {
  'role-1': [42, 120, 214],
  'role-2': [235, 104, 52],
  'role-3': [27, 175, 122],
  'role-4': [237, 161, 0],
  'status-good': [12, 163, 12],
  'status-warning': [250, 178, 25],
  'status-neutral': [100, 116, 139],
  'status-serious': [236, 131, 90]
}
const INK = [30, 41, 59]
const MUTED = [100, 116, 139]
const GRID = [226, 232, 240]

const fill = (doc, tone) => doc.setFillColor(...(TONES[tone] || MUTED))

// A filled pie slice from angle a to b (turns, 0 = 12 o'clock, clockwise), as a polygon fine enough to look round
function slice(doc, cx, cy, r, a, b) {
  const steps = Math.max(2, Math.ceil((b - a) * 120))
  const points = [[cx, cy]]
  for (let i = 0; i <= steps; i++) {
    const t = (a + ((b - a) * i) / steps) * 2 * Math.PI
    points.push([cx + r * Math.sin(t), cy - r * Math.cos(t)])
  }
  const segments = points.slice(1).map(([x, y], i) => [x - points[i][0], y - points[i][1]])
  doc.lines(segments, cx, cy, [1, 1], 'FD', true)
}

// Slices with a thin white gap between them; returns nothing when there's nothing to draw
function pie(doc, cx, cy, r, items) {
  const total = items.reduce((t, i) => t + i.value, 0)
  if (!total) {
    doc.setFillColor(...GRID).circle(cx, cy, r, 'F')
    return
  }
  doc.setDrawColor(255).setLineWidth(1)
  let start = 0
  for (const item of items.filter((i) => i.value > 0)) {
    const end = start + item.value / total
    fill(doc, item.tone)
    if (end - start >= 0.9999) doc.circle(cx, cy, r, 'F')
    else slice(doc, cx, cy, r, start, end)
    start = end
  }
}

// Legend rows: colour square, label, value (and share of the total)
function legend(doc, x, y, width, items, withShare) {
  const total = items.reduce((t, i) => t + i.value, 0)
  doc.setFontSize(8)
  items.forEach((item, i) => {
    const rowY = y + i * 13
    fill(doc, item.tone)
    doc.rect(x, rowY - 6, 7, 7, 'F')
    doc.setTextColor(...INK).text(item.label, x + 11, rowY)
    const value = withShare && total ? `${item.value}  (${Math.round((item.value / total) * 100)}%)` : String(item.value)
    doc.setFont('helvetica', 'bold').text(value, x + width, rowY, { align: 'right' }).setFont('helvetica', 'normal')
  })
}

function panel(doc, x, y, w, h, title, subtitle) {
  doc.setDrawColor(...GRID).setLineWidth(0.8).roundedRect(x, y, w, h, 6, 6, 'S')
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text(title, x + 10, y + 18)
  if (subtitle) doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(subtitle, x + 10, y + 29, { maxWidth: w - 20 })
  doc.setFont('helvetica', 'normal')
}

function rolePie(doc, x, y, w, h, rows) {
  panel(doc, x, y, w, h, 'Users by role', `${rows.length} ${rows.length === 1 ? 'user' : 'users'}`)
  const items = usersByRole(rows)
  pie(doc, x + w / 2, y + 82, 42, items)
  legend(doc, x + 12, y + 148, w - 24, items, true)
}

function statusDonut(doc, x, y, w, h, rows) {
  panel(doc, x, y, w, h, 'Account status', 'At the end of the period')
  const items = usersByStatus(rows)
  const cx = x + w / 2
  pie(doc, cx, y + 82, 42, items)
  doc.setFillColor(255).circle(cx, y + 82, 26, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...INK).text(String(rows.length), cx, y + 85, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text('users', cx, y + 94, { align: 'center' })
  legend(doc, x + 12, y + 148, w - 24, items, false)
}

// Whole-number axis steps for a count, about four gridlines
const countStep = (max) => [1, 2, 5, 10, 20, 25, 50, 100].find((s) => max / s <= 4) || Math.ceil(max / 4)

function staffBars(doc, x, y, w, h, rows) {
  const { columns, series, notActive } = usersByBranch(rows)
  panel(doc, x, y, w, h, 'Staff per branch', `Active accounts, by role${notActive ? ` · ${notActive} pending or inactive not shown` : ''}`)
  const max = Math.max(0, ...columns.flatMap((c) => c.values))
  // Room above the bars for a two-line subtitle and the numbers on top of the bars
  const plot = { left: x + 26, right: x + w - 10, top: y + 58, bottom: y + 150 }
  if (!max) {
    doc.setFontSize(8).setTextColor(...MUTED).text('No active accounts in this period.', x + w / 2, y + 100, { align: 'center' })
    return
  }
  const step = countStep(max)
  const top = Math.ceil(max / step) * step
  const yAt = (v) => plot.bottom - ((plot.bottom - plot.top) * v) / top
  doc.setFontSize(7)
  for (let v = 0; v <= top; v += step) {
    doc.setDrawColor(...GRID).setLineWidth(0.5).line(plot.left, yAt(v), plot.right, yAt(v))
    doc.setTextColor(...MUTED).text(String(v), plot.left - 5, yAt(v) + 2.5, { align: 'right' })
  }
  const groupW = (plot.right - plot.left) / columns.length
  const barW = Math.min(14, (groupW - 10) / Math.max(series.length, 1) - 2)
  columns.forEach((c, ci) => {
    const groupX = plot.left + ci * groupW + (groupW - (barW + 2) * series.length + 2) / 2
    c.values.forEach((v, si) => {
      if (!v) return
      const bx = groupX + si * (barW + 2)
      fill(doc, series[si].tone)
      doc.rect(bx, yAt(v), barW, plot.bottom - yAt(v), 'F')
      doc.setFontSize(6.5).setTextColor(...INK).text(String(v), bx + barW / 2, yAt(v) - 2, { align: 'center' })
    })
    doc.setFontSize(6.5).setTextColor(...MUTED).text(doc.splitTextToSize(c.label, groupW - 4), plot.left + ci * groupW + groupW / 2, plot.bottom + 9, { align: 'center' })
  })
  // Legend in two columns under the axis
  doc.setFontSize(7)
  series.forEach((s, i) => {
    const lx = x + 12 + (i % 2) * ((w - 24) / 2)
    const ly = y + h - 22 + Math.floor(i / 2) * 11
    fill(doc, s.tone)
    doc.rect(lx, ly - 5.5, 6, 6, 'F')
    doc.setTextColor(...INK).text(s.label, lx + 9, ly)
  })
}

function dormantPanel(doc, x, y, w, h, rows, dormantDays) {
  panel(doc, x, y, w, h, 'Dormant Accounts', `No sign-in for ${Math.round(dormantDays / 30)}+ months`)
  const { notUsed, neverJoined } = unusedAccounts(rows, dormantDays)
  const count = notUsed.length + neverJoined.length
  const cx = x + w / 2
  // Badge: green with a tick when none, orange with a cross when some
  const tone = count ? 'status-serious' : 'status-good'
  fill(doc, tone)
  doc.circle(cx, y + 56, 14, 'F')
  doc.setDrawColor(255).setLineWidth(2.2)
  if (count) {
    doc.line(cx - 5, y + 51, cx + 5, y + 61).line(cx + 5, y + 51, cx - 5, y + 61)
  } else {
    doc.line(cx - 6, y + 56, cx - 2, y + 60).line(cx - 2, y + 60, cx + 6, y + 51)
  }
  doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...INK).text(String(count), cx, y + 100, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(count === 1 ? 'dormant account' : 'dormant accounts', cx, y + 112, { align: 'center' })
  if (!count) return

  // Who, and why; the full list is in the table below when it doesn't fit
  const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const people = [
    ...notUsed.map((r) => [r.fullName, r.lastLoginAt ? `Last signed in ${date(r.lastLoginAt)}` : 'Has never signed in']),
    ...neverJoined.map((r) => [r.fullName, 'Invited, never set a password'])
  ]
  const fits = Math.floor((h - 128) / 20)
  people.slice(0, fits).forEach(([name, why], i) => {
    const ly = y + 132 + i * 20
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...INK).text(name, x + 12, ly, { maxWidth: w - 24 })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(why, x + 12, ly + 8.5, { maxWidth: w - 24 })
  })
  if (people.length > fits) doc.setFontSize(7).text(`+ ${people.length - fits} more (see the table)`, x + 12, y + h - 8)
}

/** Draws the four charts side by side from y; returns the y just below them */
export function drawAccessReviewCharts(doc, review, y) {
  const left = 40
  const width = doc.internal.pageSize.getWidth() - 80
  const gap = 12
  const w = (width - gap * 3) / 4
  const h = 214
  rolePie(doc, left, y, w, h, review.rows)
  statusDonut(doc, left + (w + gap), y, w, h, review.rows)
  staffBars(doc, left + (w + gap) * 2, y, w, h, review.rows)
  dormantPanel(doc, left + (w + gap) * 3, y, w, h, review.rows, review.summary.dormantDays)
  doc.setTextColor(0).setDrawColor(0).setLineWidth(0.2)
  return y + h
}
