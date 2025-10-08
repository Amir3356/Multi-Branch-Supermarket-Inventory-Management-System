// Formatting and small value checks shared across the app

export const CURRENCIES = {
  USD: { symbol: '$', label: 'US Dollar ($)' },
  ETB: { symbol: 'Br ', label: 'Ethiopian Birr (Br)' },
  EUR: { symbol: '€', label: 'Euro (€)' }
}

/** "$1,234.50" / "-$12.00" in the given currency */
export const formatMoneyIn = (currency, value) =>
  `${value < 0 ? '-' : ''}${CURRENCIES[currency]?.symbol || '$'}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const currencySymbol = (currency) => (CURRENCIES[currency]?.symbol || '$').trim()

/** 1,200 → "1.2K" for chart axes */
export const compactNumber = (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : String(Math.round(value)))

/** Case-insensitive comparison of two names */
export const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const isWholeNumber = (value, min, max = Infinity) =>
  Number.isInteger(Number(value)) && value !== '' && Number(value) >= min && Number(value) <= max

export const roundMoney = (value) => Math.round(value * 100) / 100

export const plural = (count, one, many) => (count === 1 ? one : many)
