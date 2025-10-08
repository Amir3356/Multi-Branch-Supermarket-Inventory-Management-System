// Date helpers shared across the app. Dates in the mock data are local calendar days (YYYY-MM-DD).

/** Local calendar date as YYYY-MM-DD */
export const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const todayKey = () => toDateKey(new Date())

/** Dashboard date filter presets; weeks start on Monday */
export const DATE_PRESETS = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  custom: 'Custom Date Range'
}

/** First and last day (inclusive) of a preset period, ending today */
export const getPresetRange = (preset) => {
  const today = new Date()
  const key = toDateKey(today)
  if (preset === 'week') {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return [toDateKey(monday), key]
  }
  if (preset === 'month') return [`${key.slice(0, 7)}-01`, key]
  if (preset === 'quarter') {
    // Calendar quarters: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3 + 1
    return [`${key.slice(0, 4)}-${String(quarterStartMonth).padStart(2, '0')}-01`, key]
  }
  if (preset === 'year') return [`${key.slice(0, 4)}-01-01`, key]
  return [key, key]
}

export const formatRangeLabel = (from, to) => {
  const fmt = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

/** "Oct 5" from a YYYY-MM-DD key */
export const shortDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const daysUntil = (date) => Math.round((date - startOfToday()) / (1000 * 60 * 60 * 24))

export const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** A date the given number of years from today, as YYYY-MM-DD */
export const yearsFromToday = (years) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return toDateKey(d)
}

/** Current time as HH:MM (24-hour) */
export const timeKey = (date = new Date()) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export const minutesBetween = (later, earlier) => Math.max(0, Math.round((later - earlier) / 60000))

export const timeAgo = (date, now) => {
  const minutes = minutesBetween(now, date)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** "Today 09:38" or "Oct 4 09:38" */
export const formatSessionTime = (date, now) => {
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return toDateKey(date) === toDateKey(now) ? `Today ${time}` : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}
