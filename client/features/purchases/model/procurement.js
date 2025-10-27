// A procurement (purchase order paid through Chapa), as the API sends it (server: Procurements/Resources/ProcurementResource.php)

/**
 * @typedef {object} Payment
 * @property {string} id                 Chapa's reference
 * @property {string} purchaseId
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} method             e.g. "Chapa · Telebirr"
 * @property {number} amount
 * @property {string} date               YYYY-MM-DD
 * @property {'Cleared'} status
 *
 * @typedef {object} ApiProcurement
 * @property {string} id                 e.g. "PO-00001"
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} category
 * @property {string} product
 * @property {string | null} medId       null for a product new to the catalog
 * @property {number} qty
 * @property {number} purchasePrice      per unit
 * @property {number} total
 * @property {'ETB' | 'USD'} currency
 * @property {string} date               YYYY-MM-DD
 * @property {'Pending' | 'Paid' | 'Failed'} status
 * @property {string | null} checkoutUrl Chapa's page, while the payment can still be finished
 * @property {Payment | null} payment    once Paid
 *
 * The procurement as kept in the store (its payment is stored separately)
 * @typedef {Omit<ApiProcurement, 'payment'>} Procurement
 *
 * Sent to POST /procurements
 * @typedef {object} ProcurementPayload
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} category
 * @property {string} product
 * @property {string} [medId]
 * @property {number} qty
 * @property {number} totalCost          the whole order; the server derives the unit price (totalCost ÷ qty)
 * @property {'ETB' | 'USD'} currency
 */

export const EMPTY_PURCHASE_FORM = { branchId: '', supplier: '', category: '', medId: '', qty: '', totalCost: '' }

/** The unit purchase price a Total Cost works out to, or null until both numbers are valid */
export const unitPriceFrom = (totalCost, qty) => (Number.isInteger(qty) && qty > 0 && totalCost > 0 ? Math.round((totalCost / qty) * 100) / 100 : null)

/** @returns {Omit<ProcurementPayload, 'currency'>} the order from the form; the currency is added from settings */
export const toProcurementPayload = (form, product, qty, totalCost) => ({
  branchId: form.branchId,
  supplier: form.supplier.trim(),
  category: product.category,
  product: product.name,
  medId: product.id,
  totalCost: Math.round(totalCost * 100) / 100,
  qty
})

/** The batch number a paid procurement's stock was received under (receiveStock uses the procurement ID) */
export const procurementBatch = (procurement) => procurement.batch || procurement.id

/** @returns {{ procurement: Procurement, payment: Payment | null }} */
export const procurementFromApi = ({ payment, ...procurement }) => ({ procurement, payment })
