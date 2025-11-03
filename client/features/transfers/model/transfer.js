// A stock transfer, as the API sends it (server: Transfers/Resources/TransferResource.php)

/**
 * @typedef {object} Transfer
 * @property {string} id                  e.g. "TRF-00001"
 * @property {string} from                sending branch id
 * @property {string} to                  receiving branch id
 * @property {string} category
 * @property {string} product
 * @property {string | null} medId
 * @property {string} batch             the sending branch's batch number
 * @property {string | null} receivedBatch the new batch the receiving branch added it under (generated, BT-00001, …)
 * @property {string | null} expiry       YYYY-MM-DD
 * @property {number} qty
 * @property {'Pending' | 'Received'} status  Pending until the receiving branch adds it with Add Medicine
 * @property {string} date                YYYY-MM-DD it was sent
 * @property {string | null} sentBy
 * @property {string | null} receivedBy
 * @property {string | null} receivedAt   ISO timestamp
 *
 * Sent to POST /transfers
 * @typedef {{ from: string, to: string, category: string, product: string, medId?: string, batch: string, expiry?: string, qty: number }} TransferPayload
 */

export const isPending = (transfer) => transfer.status === 'Pending'
