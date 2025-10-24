// An Inventory Officer's request to send stock back to the supplier, as the API sends it
// (server: ReturnRequests/Resources/ReturnRequestResource.php)

/**
 * @typedef {object} ReturnRequest
 * @property {number} id
 * @property {string} procurementId          the paid procurement the stock came from
 * @property {string} batch                  the batch it was received under
 * @property {string} branchId
 * @property {string} supplier
 * @property {string} category
 * @property {string} product
 * @property {string | null} medId
 * @property {number} qty
 * @property {string} reason
 * @property {string | null} note
 * @property {'Pending' | 'Approved' | 'Rejected' | 'Replaced' | 'Partially Replaced'} status
 * @property {string | null} requestedBy
 * @property {string} requestedAt            ISO timestamp
 * @property {string | null} handledBy       the Procurement Officer who approved or rejected it
 * @property {string | null} handledAt       ISO timestamp
 * @property {string | null} responseNote    why it was rejected
 * @property {number | null} replacedQty     good units the supplier sent back in place of the returned ones
 * @property {string | null} replacedBy
 * @property {string | null} replacedAt      ISO timestamp
 * @property {string | null} replacementNote
 *
 * Sent to POST /return-requests
 * @typedef {{ procurementId: string, qty: number, reason: string, note?: string }} ReturnRequestPayload
 *
 * Sent to POST /return-requests/{id}/replace
 * @typedef {{ qty: number, note?: string }} ReplacementPayload
 */

export const EMPTY_RETURN_REQUEST_FORM = { procurementId: '', qty: '', reason: '', note: '' }

/** @returns {ReturnRequestPayload} */
export const toReturnRequestPayload = (form) => ({
  procurementId: form.procurementId,
  qty: Number(form.qty),
  reason: form.reason,
  note: form.note.trim() || undefined
})

/** Units of a procurement asked for or sent back (every request but rejected ones), less what the supplier replaced */
export const claimedQty = (requests, procurementId) =>
  requests.filter((r) => r.procurementId === procurementId && r.status !== 'Rejected').reduce((sum, r) => sum + r.qty - (r.replacedQty || 0), 0)
