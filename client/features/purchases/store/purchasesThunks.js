import { createProcurement, fetchProcurements, receiveProcurement, verifyProcurementPayment } from '../api/procurementsApi'
import { findCatalogProduct, nextId, yearsFromToday } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { categoryAdded, productAdded, productUpdated } from '../../inventory/store/productsSlice'
import { stockReceived } from '../../inventory/store/stockSlice'
import { procurementBatch, procurementFromApi } from '../model/procurement'
import { paymentSaved, purchaseSaved } from './purchasesSlice'

// Procurements live on the server and are paid through Chapa. Paying puts the product in the catalog; its stock enters
// the receiving branch's Inventory only when that branch's Inventory Officer adds it (Add Medicine). Each step happens
// the first time this browser sees it, so loading the list again never double-counts.

// The catalog product a paid order bought; a product new to the catalog is added (selling price set with Add Medicine)
const productFor = (procurement) => (dispatch, getState) => {
  const { state, money } = thunkContext(getState)
  const { id, category, product, purchasePrice } = procurement
  dispatch(categoryAdded(category))
  let medId = findCatalogProduct(state.products.items, procurement.medId, product)?.id
  if (!medId) {
    medId = nextId(state.products.items, 'MED')
    dispatch(productAdded({ id: medId, name: product, category, purchasePrice, sellingPrice: null, reorderLevel: state.settings.defaultMinStock }))
    dispatch(logAdded('Product added', 'Inventory', medId, `${product} added to ${category} through purchase ${id} (purchase price ${money(purchasePrice)}).`))
  }
  return medId
}

// Paid: the product is ready for Add Medicine at the receiving branch, but nothing is in stock yet
const procurementPaid = (procurement) => (dispatch, getState) => {
  const { money, branchName } = thunkContext(getState)
  dispatch(productFor(procurement))
  dispatch(logAdded('Purchase paid', 'Purchase', procurement.id, `${procurement.qty} × ${procurement.product} bought from ${procurement.supplier} for ${branchName(procurement.branchId)} (${money(procurement.total)}), paid through Chapa; waiting to be added to stock.`))
}

// Added with Add Medicine: the units enter the branch's stock under the batch and expiry date entered then
const receiveStock = (procurement) => (dispatch) => {
  const medId = dispatch(productFor(procurement))
  dispatch(stockReceived({ medId, branchId: procurement.branchId, qty: procurement.qty, batch: procurementBatch(procurement), expiry: procurement.expiryDate || yearsFromToday(2) }))
}

// Keeps the browser's copy in step with the API's
const procurementSynced = (apiProcurement) => (dispatch, getState) => {
  const { procurement, payment } = procurementFromApi(apiProcurement)
  const known = getState().purchases.items.find((p) => p.id === procurement.id)
  dispatch(purchaseSaved(procurement))
  if (payment) dispatch(paymentSaved(payment))
  if (procurement.status === 'Paid' && known?.status !== 'Paid') dispatch(procurementPaid(procurement))
  if (procurement.receivedAt && !known?.receivedAt) dispatch(receiveStock(procurement))
}

// Inventory Officer (Add Medicine): add a paid order's stock to their branch with the expiry on the package (the server
// generates its batch number), and set its selling price; returns the confirmation, or throws ApiError (e.g. already added on another screen)
export const addProcurementToStock = (procurement, sellingPrice, { expiryDate }) => async (dispatch, getState) => {
  // The server saves the product's shared prices too (this order's unit cost, and the selling price)
  const { procurement: received } = await receiveProcurement(procurement.id, { expiryDate, sellingPrice })
  dispatch(procurementSynced(received))
  const { state, money, branchName } = thunkContext(getState)
  const product = findCatalogProduct(state.products.items, received.medId, received.product)
  dispatch(productUpdated({ id: product.id, changes: { purchasePrice: received.purchasePrice, sellingPrice } }))
  dispatch(logAdded('Stock added', 'Inventory', received.id, `${received.qty} × ${received.product} (batch ${procurementBatch(received)}) added to ${branchName(received.branchId)}; selling price ${money(sellingPrice)}.`))
  const where = branchName(received.branchId)
  return `${received.qty} × ${received.product} added to ${where ? `${where}'s` : 'your branch’s'} stock as batch ${procurementBatch(received)}, at ${money(sellingPrice)} per unit.`
}

// A procurement pushed over the WebSocket (created, or its payment settled): a Paid one's stock reaches its
// receiving branch's Inventory at once, and only once
export const procurementPushed = (procurement) => (dispatch) => dispatch(procurementSynced(procurement))

export const loadProcurements = () => async (dispatch) => {
  const { data } = await fetchProcurements()
  // Oldest first, so each one lands on top of the list in date order
  ;[...data].reverse().forEach((procurement) => dispatch(procurementSynced(procurement)))
}

// Saves the order as Pending and returns its id and Chapa's checkout page to pay on; failures throw ApiError
export const startProcurement = (data) => async (dispatch, getState) => {
  const { currency } = getState().settings
  const { procurement, checkoutUrl } = await createProcurement({ ...data, currency })
  dispatch(procurementSynced(procurement))
  dispatch(logAdded('Purchase created', 'Purchase', procurement.id, `${procurement.qty} × ${procurement.product} ordered from ${procurement.supplier}; awaiting Chapa payment.`))
  return { id: procurement.id, checkoutUrl }
}

// Confirms the payment with the API and returns a notice for the page, with the procurement's status
export const verifyProcurement = (id) => async (dispatch) => {
  const { procurement, message } = await verifyProcurementPayment(id)
  dispatch(procurementSynced(procurement))
  return { type: procurement.status === 'Paid' ? 'success' : procurement.status === 'Failed' ? 'error' : 'info', text: message, status: procurement.status }
}
