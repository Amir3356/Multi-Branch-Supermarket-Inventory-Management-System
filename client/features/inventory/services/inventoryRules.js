import { isWholeNumber, sameText } from '../../../utils'

const isPositivePrice = (raw, value) => raw !== '' && !Number.isNaN(value) && value > 0

// The catalog product a procurement bought: matched by id, or by name for a product the purchase added
export const findProcurementProduct = (products, procurement) =>
  procurement ? products.find((p) => p.id === procurement.medId || sameText(p.name, procurement.product)) : undefined

// Field errors for Add Medicine (setting the selling price for a paid procurement's product)
export function validateMedicinePrices(form, procurement, product, sellingPrice) {
  const errors = {}
  if (!procurement) errors.purchaseId = 'Select a procurement'
  else if (!product) errors.purchaseId = "This product isn't in the catalog yet. Reload the page and try again."
  if (!isPositivePrice(form.sellingPrice, sellingPrice)) errors.sellingPrice = 'Enter a selling price greater than 0'
  return errors
}

// Field errors for editing one branch's inventory row
export function validateInventoryItem(form, purchasePrice, sellingPrice) {
  const errors = {}
  if (!isWholeNumber(form.stock, 0)) errors.stock = 'Enter a whole number of 0 or more'
  if (!form.batch.trim()) errors.batch = 'Batch number is required'
  if (!form.expiry) errors.expiry = 'Expiration date is required'
  if (!isPositivePrice(form.purchasePrice, purchasePrice)) errors.purchasePrice = 'Enter a price greater than 0'
  if (!isPositivePrice(form.sellingPrice, sellingPrice)) errors.sellingPrice = 'Enter a price greater than 0'
  return errors
}
