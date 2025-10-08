// Stock rules: status comes from quantity; expiry is tracked separately

export const STOCK_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock']

/** In Stock, Low Stock (below the minimum stock level), or Out of Stock (none left) */
export const getStockStatus = (stock, minLevel, settings) => {
  if (stock <= 0) return 'Out of Stock'
  if (settings.lowStockAlerts && stock < minLevel) return 'Low Stock'
  return 'In Stock'
}

/** A batch within the expiry warning window */
export const isExpiringSoon = (expiry, settings) =>
  settings.expiryAlerts && (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24) <= settings.expiryWarningDays

/** Inventory rows: one per product per branch, joined with the catalog and stock rules */
export const buildInventory = (settings, stockLevels, products) =>
  stockLevels.map((entry) => {
    const product = products.find((m) => m.id === entry.medId)
    const reorderLevel = settings.defaultMinStock
    return {
      ...product,
      ...entry,
      reorderLevel,
      key: `${entry.medId}-${entry.branchId}`,
      status: getStockStatus(entry.stock, reorderLevel, settings),
      expiringSoon: isExpiringSoon(entry.expiry, settings)
    }
  })
