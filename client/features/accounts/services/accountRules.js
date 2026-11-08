import { coversAllBranches } from '../model/account'

// Field errors for the Add/Edit Account form; empty when it can be saved. `email` is already trimmed and lower-cased.
export function validateAccount(form, email) {
  const errors = {}
  if (!form.role) errors.role = 'Select a role'
  if (!form.fullName.trim()) errors.fullName = 'Full name is required'
  if (!email) errors.email = 'Email is required'
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address'
  // The Purchase Officer covers every branch; Inventory Officers and Cashiers work at one
  if (!form.branchId && !coversAllBranches(form.role)) errors.branchId = 'Assign a branch'
  return errors
}

// Same limit as the server's ACCESS_REVIEW_DORMANT_DAYS default, until the account list sends its own
export const DEFAULT_DORMANT_DAYS = 90

const DAY_MS = 86_400_000

/**
 * Staff accounts nobody is using: Active, not the Owner, and no sign-in for `dormantDays` or more (or never).
 * Each with `daysSinceLogin` (null = never signed in); never-used accounts first, then the longest unused.
 */
export function dormantAccounts(accounts, dormantDays, now = new Date()) {
  return accounts
    .filter((a) => a.status === 'Active' && a.role !== 'owner')
    .map((a) => ({ ...a, daysSinceLogin: a.lastLoginAt ? Math.floor((now - new Date(a.lastLoginAt)) / DAY_MS) : null }))
    .filter((a) => a.daysSinceLogin === null || a.daysSinceLogin >= dormantDays)
    .sort((a, b) => (b.daysSinceLogin ?? Infinity) - (a.daysSinceLogin ?? Infinity))
}

/** "45 days", "about 4 months", "over a year" */
export const howLongUnused = (days) => (days >= 365 ? 'over a year' : days >= 60 ? `about ${Math.round(days / 30)} months` : `${days} days`)
