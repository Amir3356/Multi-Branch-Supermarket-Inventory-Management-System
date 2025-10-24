import { nextId, todayKey } from '../../../utils'
import { procurementBatch } from '../../purchases/model/procurement'

// Why stock goes back to a supplier; used by the Inventory Officer's request and the supplier return
export const SUPPLIER_RETURN_REASONS = [
  'Short delivery (missing quantity)',
  'Expired',
  'Near expiry (short shelf life)',
  'Damaged on arrival',
  'Broken seal or tampered packaging',
  'Temperature damage (cold chain broken)',
  'Contaminated or discoloured',
  'Defective item',
  'Wrong item delivered',
  'Wrong strength or dosage form',
  'Wrong quantity delivered',
  'Batch number or expiry not as ordered',
  'Missing or incorrect labelling',
  'Product recall',
  'Regulatory withdrawal (EFDA)',
  'Unregistered or suspected counterfeit',
  'Quality complaint',
  'Overstock',
  'Slow-moving stock',
  'Not ordered',
  'Other'
]

// Stock sent back from one batch (one purchase); the supplier owes `credit` for it
// requestId: the Inventory Officer's request it was approved from; replacedQty: good units the supplier sent back
export const createSupplierReturn = (existingReturns, { requestId, purchase, medId, qty, reason, credit }) => ({
  id: nextId(existingReturns, 'SRT'),
  requestId,
  purchaseId: purchase.id,
  batch: procurementBatch(purchase),
  branchId: purchase.branchId,
  supplier: purchase.supplier,
  medId,
  product: purchase.product,
  category: purchase.category,
  qty,
  reason,
  credit,
  replacedQty: 0,
  date: todayKey()
})

/** What the supplier still owes: replaced units settle their share of the credit */
export const creditOwed = (record) => (record.qty ? record.credit * (record.qty - (record.replacedQty || 0)) / record.qty : 0)

/** Credit owed · Partially Replaced · Replaced */
export const supplierReturnStatus = (record) =>
  !record.replacedQty ? 'Credit Owed' : record.replacedQty >= record.qty ? 'Replaced' : 'Partially Replaced'
