// Stock rules: status comes from quantity; expiry is tracked separately, and the Inventory table's Status shows both
import { todayKey } from './dates'

export const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock']

// What the Inventory table's Status column can show
export const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Expiring Soon', 'Expired', 'Out of Stock']

/** In Stock, Low Stock (below the minimum stock level), or Out of Stock (none left) */
export const getStockStatus = (stock, minLevel, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (settings.lowStockAlerts && stock < minLevel) return 'Low Stock'
  return 'In Stock'
}

/** Past its expiration date (YYYY-MM-DD): from the day after it, in this computer's local time */
export const isExpired = (expiry) => Boolean(expiry) && expiry < todayKey()

/** Whole calendar days from today to an expiry date (YYYY-MM-DD): 0 today, 1 tomorrow, negative once past */
export const daysToExpiry = (expiry) => Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000)

/** A batch within the expiry warning window (expired ones included). Counted in calendar days, so the result is the
 * same at any time of day. */
export const isExpiringSoon = (expiry, settings) =>
  Boolean(settings.expiryAlerts && expiry) && daysToExpiry(expiry) <= settings.expiryWarningDays

/**
 * The Inventory table's Status: none left wins, then expiry, then quantity. An expired batch stays Expired however
 * many units it has; one inside the warning window (Policy → Expiring Soon) is Expiring Soon until its date passes.
 */
export const getInventoryStatus = (stock, quantityStatus, expiry, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (isExpired(expiry)) return 'Expired'
  if (isExpiringSoon(expiry, settings)) return 'Expiring Soon'
  return quantityStatus
}

/** Inventory rows: one per product per branch, joined with the catalog and stock rules */
export const buildInventory = (settings, stockLevels, products) =>
  stockLevels.map((entry) => {
    const product = products.find((m) => m.id === entry.medId)
    const reorderLevel = settings.defaultMinStock
    const status = getStockStatus(entry.stock, reorderLevel, settings)
    return {
      ...product,
      ...entry,
      reorderLevel,
      key: `${entry.medId}-${entry.branchId}`,
      // Quantity only (In Stock / Low Stock / Out of Stock), for stock counts and low-stock alerts
      status,
      expiringSoon: isExpiringSoon(entry.expiry, settings),
      expired: isExpired(entry.expiry),
      // What the Status column shows: quantity and expiry together
      inventoryStatus: getInventoryStatus(entry.stock, status, entry.expiry, settings)
    }
  })
