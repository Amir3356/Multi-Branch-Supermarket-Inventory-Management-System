import { nextId, todayKey } from '../../../utils'

// A return against a sale; batch is the branch's current batch for the product, when it has one
export const createCustomerReturn = (existingReturns, { sale, product, stockEntry, qty, reason, condition, refund }) => ({
  id: nextId(existingReturns, 'RTN'),
  saleId: sale.id,
  branchId: sale.branchId,
  customer: sale.customer,
  medId: product?.id,
  product: sale.product,
  category: sale.category,
  batch: stockEntry?.batch || '—',
  qty,
  reason,
  condition,
  refund,
  date: todayKey()
})
