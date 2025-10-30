// Date helpers shared across the app. Dates in the mock data are local calendar days (YYYY-MM-DD).

/** Local calendar date as YYYY-MM-DD */
export const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const todayKey = () => toDateKey(new Date())

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
