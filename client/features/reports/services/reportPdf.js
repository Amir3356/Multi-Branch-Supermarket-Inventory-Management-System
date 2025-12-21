// A report as a printable PDF (landscape A4): header, the cards as a summary row, the charts two to a row, then every
// table. It draws the same spec as the page, so the PDF and the screen always show the same figures. The page is white,
// so chart colours are the palette's light-surface steps; every slice and bar also carries its value as text.

const TONES = {
  'role-1': [42, 120, 214],
  'role-2': [235, 104, 52],
  'role-3': [27, 175, 122],
  'role-4': [237, 161, 0],
  slate: [100, 116, 139],
  'status-good': [12, 163, 12],
  'status-warning': [250, 178, 25],
  'status-serious': [236, 131, 90],
  'status-critical': [208, 59, 59],
  'status-neutral': [100, 116, 139]
}
const INK = [30, 41, 59]
const MUTED = [100, 116, 139]
const GRID = [226, 232, 240]
const HEAD = [8, 145, 178]
const MARGIN = 40

const fill = (doc, tone) => doc.setFillColor(...(TONES[tone] || MUTED))
const plain = (v) => Number(v).toLocaleString('en-US')
// Money on a chart axis: "12.5K", "1.2M"
const short = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K` : plain(Math.round(v)))

// ---- Charts ----

function slice(doc, cx, cy, r, a, b) {
  const steps = Math.max(2, Math.ceil((b - a) * 120))
  const points = [[cx, cy]]
  for (let i = 0; i <= steps; i++) {
    const t = (a + ((b - a) * i) / steps) * 2 * Math.PI
    points.push([cx + r * Math.sin(t), cy - r * Math.cos(t)])
  }
  doc.lines(points.slice(1).map(([x, y], i) => [x - points[i][0], y - points[i][1]]), cx, cy, [1, 1], 'FD', true)
}

function pie(doc, cx, cy, r, items) {
  const shown = items.filter((i) => i.value > 0)
  const total = shown.reduce((t, i) => t + i.value, 0)
  doc.setDrawColor(255).setLineWidth(1)
  let start = 0
  for (const item of shown) {
    const end = start + item.value / total
    fill(doc, item.tone)
    if (end - start >= 0.9999) doc.circle(cx, cy, r, 'F')
    else slice(doc, cx, cy, r, start, end)
    start = end
  }
}

function legend(doc, x, y, width, items, format, withShare) {
  const total = items.reduce((t, i) => t + i.value, 0)
  doc.setFontSize(7.5)
  items.forEach((item, i) => {
    const ly = y + i * 12
    fill(doc, item.tone)
    doc.rect(x, ly - 6, 7, 7, 'F')
    doc.setTextColor(...INK).text(doc.splitTextToSize(item.label, width - 95)[0], x + 11, ly)
    const value = withShare && total ? `${format(item.value)}  (${Math.round((item.value / total) * 100)}%)` : format(item.value)
    doc.setFont('helvetica', 'bold').text(value, x + width, ly, { align: 'right' }).setFont('helvetica', 'normal')
  })
}

function drawPieChart(doc, chart, x, y, w, h, format, donut) {
  const total = chart.items.reduce((t, i) => t + i.value, 0)
  const r = Math.min(52, (h - 40) / 2)
  const cx = x + 14 + r
  const cy = y + 42 + r
  if (!total) return empty(doc, chart, x, y, w, h)
  pie(doc, cx, cy, r, chart.items)
  if (donut) {
    doc.setFillColor(255).circle(cx, cy, r * 0.62, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK).text(plain(total), cx, cy + 3, { align: 'center' })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(chart.unit || '', cx, cy + 12, { align: 'center' })
  }
  legend(doc, cx + r + 18, y + 54, w - (cx + r + 18 - x) - 12, chart.items, donut ? plain : format, !donut)
}

function drawHBars(doc, chart, x, y, w, h, format) {
  const items = chart.items.slice(0, Math.floor((h - 46) / 17))
  if (!items.length || items.every((i) => !i.value)) return empty(doc, chart, x, y, w, h)
  const max = Math.max(...items.map((i) => i.value), 1)
  const labelW = Math.min(110, w * 0.32)
  const valueW = 110
  const trackW = w - 24 - labelW - valueW
  items.forEach((item, i) => {
    const ly = y + 50 + i * 17
    doc.setFontSize(7.5).setTextColor(...INK).text(doc.splitTextToSize(item.label, labelW - 4)[0], x + 12, ly + 4)
    doc.setFillColor(...GRID).roundedRect(x + 12 + labelW, ly - 2, trackW, 7, 3, 3, 'F')
    fill(doc, item.tone)
    if (item.value > 0) doc.roundedRect(x + 12 + labelW, ly - 2, Math.max(3, (trackW * item.value) / max), 7, 3, 3, 'F')
    doc.setFont('helvetica', 'bold').text(format(item.value), x + w - 12 - (item.detail ? 48 : 0), ly + 4, { align: 'right' }).setFont('helvetica', 'normal')
    if (item.detail) doc.setFontSize(6.5).setTextColor(...MUTED).text(item.detail, x + w - 12, ly + 4, { align: 'right' })
  })
}

// Whole-number-friendly axis steps
const niceStep = (max, whole) => {
  const rough = Math.max(max / 4, whole ? 1 : 0)
  const power = 10 ** Math.floor(Math.log10(rough || 1))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((v) => v >= rough && (!whole || Number.isInteger(v))) || rough
}

function drawBars(doc, chart, x, y, w, h, format, isMoney) {
  const { columns, series } = chart
  const max = Math.max(0, ...columns.flatMap((c) => c.values))
  if (!max) return empty(doc, chart, x, y, w, h)
  const plot = { left: x + 40, right: x + w - 10, top: y + 52, bottom: y + h - 40 }
  const step = niceStep(max, chart.wholeNumbers)
  const top = Math.ceil(max / step) * step
  const yAt = (v) => plot.bottom - ((plot.bottom - plot.top) * v) / top
  doc.setFontSize(6.5)
  for (let v = 0; v <= top + step / 2; v += step) {
    doc.setDrawColor(...GRID).setLineWidth(0.5).line(plot.left, yAt(v), plot.right, yAt(v))
    doc.setTextColor(...MUTED).text(isMoney ? short(v) : plain(v), plot.left - 4, yAt(v) + 2, { align: 'right' })
  }
  const groupW = (plot.right - plot.left) / columns.length
  const barW = Math.max(2, Math.min(16, (groupW - 6) / series.length - 2))
  const labelEvery = Math.ceil(columns.length / 12)
  columns.forEach((c, ci) => {
    const gx = plot.left + ci * groupW + (groupW - (barW + 2) * series.length + 2) / 2
    c.values.forEach((v, si) => {
      if (!v) return
      fill(doc, series[si].tone)
      doc.rect(gx + si * (barW + 2), yAt(v), barW, plot.bottom - yAt(v), 'F')
      // Values over the bars only when there's room for them
      if (columns.length * series.length <= 16) doc.setFontSize(6).setTextColor(...INK).text(isMoney ? short(v) : plain(v), gx + si * (barW + 2) + barW / 2, yAt(v) - 2, { align: 'center' })
    })
    if (ci % labelEvery === 0) doc.setFontSize(6.5).setTextColor(...MUTED).text(doc.splitTextToSize(c.label, groupW * labelEvery - 2)[0], plot.left + ci * groupW + groupW / 2, plot.bottom + 9, { align: 'center' })
  })
  doc.setFontSize(7)
  let lx = plot.left
  series.forEach((s) => {
    fill(doc, s.tone)
    doc.rect(lx, y + h - 20, 6, 6, 'F')
    doc.setTextColor(...INK).text(s.label, lx + 9, y + h - 14.5)
    lx += doc.getTextWidth(s.label) + 24
  })
}

function empty(doc, chart, x, y, w, h) {
  doc.setFontSize(8).setTextColor(...MUTED).text(chart.empty || 'Nothing to show.', x + w / 2, y + h / 2 + 10, { align: 'center' })
}

// A headline figure: a badge (green tick when none, orange cross when some), the big count, then who it is about
function drawHeadline(doc, chart, x, y, w, h) {
  const cx = x + w / 2
  const warn = chart.count > 0
  fill(doc, warn ? 'status-serious' : 'status-good')
  doc.circle(cx, y + 54, 13, 'F')
  doc.setDrawColor(255).setLineWidth(2.2)
  if (warn) doc.line(cx - 5, y + 49, cx + 5, y + 59).line(cx + 5, y + 49, cx - 5, y + 59)
  else doc.line(cx - 6, y + 54, cx - 2, y + 58).line(cx - 2, y + 58, cx + 6, y + 49)
  doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...INK).text(String(chart.count), cx, y + 96, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(chart.label, cx, y + 107, { align: 'center' })
  if (!warn) return
  const fits = Math.floor((h - 122) / 19)
  chart.list.slice(0, fits).forEach((item, i) => {
    const ly = y + 124 + i * 19
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...INK).text(item.name, x + 14, ly, { maxWidth: w - 28 })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(item.why, x + 14, ly + 8.5, { maxWidth: w - 28 })
  })
  if (chart.list.length > fits) doc.setFontSize(7).text(`+ ${chart.list.length - fits} more (see the table)`, x + 14, y + h - 8)
}

function chartPanel(doc, chart, x, y, w, h, money) {
  doc.setDrawColor(...GRID).setLineWidth(0.8).roundedRect(x, y, w, h, 6, 6, 'S')
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text(chart.title, x + 12, y + 18)
  if (chart.subtitle) doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED).text(chart.subtitle, x + 12, y + 29, { maxWidth: w - 24 })
  doc.setFont('helvetica', 'normal')
  const format = chart.money ? money : plain
  if (chart.kind === 'headline') drawHeadline(doc, chart, x, y, w, h)
  else if (chart.kind === 'pie') drawPieChart(doc, chart, x, y, w, h, format, false)
  else if (chart.kind === 'donut') drawPieChart(doc, chart, x, y, w, h, format, true)
  else if (chart.kind === 'hbar') drawHBars(doc, chart, x, y, w, h, format)
  else drawBars(doc, chart, x, y, w, h, format, chart.money)
}

// ---- Document ----

// jsPDF's built-in font only has basic Latin characters: swap the few the screen uses that it can't draw
const PDF_SAFE = [[/−/g, '-'], [/▲/g, '+'], [/▼/g, '-'], [/→/g, '->'], [/×/g, 'x']]
const pdfText = (value) => (typeof value === 'string' ? PDF_SAFE.reduce((text, [from, to]) => text.replace(from, to), value) : value)
const pdfSafe = (value) => (Array.isArray(value) ? value.map(pdfSafe) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pdfSafe(v)])) : pdfText(value))

/** Builds the report as a jsPDF document (also used to check the output without downloading) */
export function buildReportPdf({ title, spec: screenSpec, pharmacyName, periodText, scope }, { jsPDF, autoTable }, money) {
  const spec = pdfSafe(screenSpec)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const width = pageW - MARGIN * 2

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(0).text(`${pharmacyName} - ${title}`, MARGIN, 44)
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(90)
  doc.text(`Period: ${periodText} · ${scope}`, MARGIN, 62)
  doc.text(`Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}${spec.note ? ` · ${spec.note}` : ''}`, MARGIN, 75, { maxWidth: width })

  // The cards, as one summary row
  autoTable(doc, {
    startY: 88,
    head: [spec.cards.map((c) => c.title)],
    body: [spec.cards.map((c) => c.value), spec.cards.map((c) => c.chip || '')],
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 5 },
    headStyles: { fillColor: HEAD },
    didParseCell: (cell) => {
      if (cell.section === 'body' && cell.row.index === 0) Object.assign(cell.cell.styles, { fontStyle: 'bold', fontSize: 12 })
      if (cell.section === 'body' && cell.row.index === 1) Object.assign(cell.cell.styles, { fontSize: 7.5, textColor: MUTED })
    }
  })

  // Charts, two to a row, on new pages as needed
  const gap = 14
  const chartW = (width - gap) / 2
  // Short enough for two rows of charts under the summary on the first page
  const chartH = 185
  let y = doc.lastAutoTable.finalY + 16
  spec.charts.forEach((chart, i) => {
    if (i % 2 === 0 && i > 0) y += chartH + gap
    if (i % 2 === 0 && y + chartH > pageH - 30) {
      doc.addPage()
      y = MARGIN
    }
    chartPanel(doc, chart, MARGIN + (i % 2) * (chartW + gap), y, chartW, chartH, money)
  })
  y += chartH + 22

  // Every table
  spec.tables.forEach((table) => {
    if (y > pageH - 90) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(table.title, MARGIN, y)
    if (table.note) doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED).text(table.note, pageW - MARGIN, y, { align: 'right' })
    const align = Object.fromEntries(table.columns.map((c, j) => [j, { halign: c.align === 'right' ? 'right' : 'left' }]))
    autoTable(doc, {
      startY: y + 6,
      head: [table.columns.map((c) => c.label)],
      body: table.rows.length ? table.rows : [[{ content: table.empty, colSpan: table.columns.length, styles: { halign: 'center', textColor: MUTED } }]],
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
      headStyles: { fillColor: HEAD },
      columnStyles: align,
      didParseCell: (cell) => {
        if (cell.section === 'body' && table.strongRows?.includes(cell.row.index)) cell.cell.styles.fontStyle = 'bold'
        if (cell.section === 'head') cell.cell.styles.halign = align[cell.column.index]?.halign || 'left'
      }
    })
    y = doc.lastAutoTable.finalY + 10
    if (table.footnote) {
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(table.footnote, MARGIN, y + 4, { maxWidth: width })
      y += 12
    }
    y += 16
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page).setFontSize(8).setTextColor(130)
    doc.text(`${title} · Page ${page} of ${pages}`, pageW - MARGIN, pageH - 20, { align: 'right' })
  }
  return doc
}

/** Downloads the report as a PDF; jsPDF loads only when someone exports */
export async function exportReportPdf({ title, spec, pharmacyName, periodText, scope, kind, from, to }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // Plain "ETB 1,234.00": jsPDF's built-in font has no special characters
  const money = (v) => `ETB ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  buildReportPdf({ title, spec, pharmacyName, periodText, scope }, { jsPDF, autoTable }, money).save(`${kind}-report-${from}-to-${to}.pdf`)
}
