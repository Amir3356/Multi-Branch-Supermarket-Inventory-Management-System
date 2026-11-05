import { iso8601 } from '../utils/index.js'
import { localDate, ucfirst } from '../utils/php.js'

// A purchase order bought for a branch and paid through Chapa; its Inventory Officer then adds the stock
export const TABLE = 'procurements'
export const ID_PREFIX = 'PO'
// The model name Laravel's 404 message carries
export const MODEL_CLASS = 'App\\Features\\Procurements\\Models\\Procurement'
// The currencies Chapa accepts
export const CURRENCIES = ['ETB', 'USD']
// The columns update() may change
export const UPDATABLE_COLUMNS = new Set(['status', 'paid_at', 'chapa_reference', 'payment_method', 'checkout_url', 'received_at', 'received_by', 'batch', 'expiry_date'])

export const isPending = (procurement) => procurement.status === 'pending'

/** Paid, and its Inventory Officer hasn't added the stock yet */
export const awaitsReceipt = (procurement) => procurement.status === 'paid' && procurement.received_at === null

/** ProcurementResource: shaped like the React app's purchase rows; a paid one also carries its payment history row */
export function toResource(p) {
  const isPaid = p.status === 'paid'
  return {
    id: p.id,
    branchId: p.branch_id,
    supplier: p.supplier,
    category: p.category,
    product: p.product,
    medId: p.med_id,
    qty: p.qty,
    purchasePrice: Number(p.unit_price),
    total: Number(p.total),
    currency: p.currency,
    date: localDate(p.created_at),
    status: ucfirst(p.status),
    // Lets the officer finish a payment they left half way
    checkoutUrl: isPending(p) ? p.checkout_url : null,
    // Set when the receiving branch's Inventory Officer added the stock (Add Medicine); until then it isn't in stock
    receivedAt: iso8601(p.received_at),
    // The batch number generated when the stock was added (older orders: their procurement ID)
    batch: p.batch,
    expiryDate: p.expiry_date ?? null,
    payment: isPaid
      ? {
          id: p.chapa_reference || p.tx_ref,
          purchaseId: p.id,
          branchId: p.branch_id,
          supplier: p.supplier,
          method: p.payment_method ? `Chapa · ${ucfirst(p.payment_method)}` : 'Chapa',
          amount: Number(p.total),
          date: localDate(p.paid_at),
          status: 'Cleared',
        }
      : null,
  }
}
