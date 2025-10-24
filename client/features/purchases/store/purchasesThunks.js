import { createProcurement, fetchProcurements, verifyProcurementPayment } from '../api/procurementsApi'
import { nextId, sameText, yearsFromToday } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { categoryAdded, productAdded } from '../../inventory/store/productsSlice'
import { stockReceived } from '../../inventory/store/stockSlice'
import { procurementBatch, procurementFromApi } from '../model/procurement'
import { paymentSaved, purchaseSaved } from './purchasesSlice'

// Procurements live on the server and are paid through Chapa. A procurement adds stock only once it is Paid,
// and only the first time this browser sees it Paid, so loading the list again never double-counts.

// A paid procurement's stock arrives at its branch. A product new to the catalog is added (selling price set later
// with Add Medicine), gets the procurement ID as its batch and a default two-year expiry.
const receiveStock = (procurement) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const { id, branchId, category, product, qty, purchasePrice, supplier, total } = procurement
  dispatch(categoryAdded(category))

  let medId = state.products.items.find((p) => p.id === procurement.medId || sameText(p.name, product))?.id
  if (!medId) {
    medId = nextId(state.products.items, 'MED')
    dispatch(productAdded({ id: medId, name: product, category, purchasePrice, sellingPrice: null, reorderLevel: state.settings.defaultMinStock }))
    dispatch(logAdded('Product added', 'Inventory', medId, `${product} added to ${category} through purchase ${id} (purchase price ${money(purchasePrice)}).`))
  }
  dispatch(stockReceived({ medId, branchId, qty, batch: procurementBatch(procurement), expiry: yearsFromToday(2) }))
  dispatch(logAdded('Purchase paid', 'Purchase', id, `${qty} × ${product} bought from ${supplier} into ${branchName(branchId)} for ${money(total)}, paid through Chapa.`))
}

// Keeps the browser's copy in step with the API's
const procurementSynced = (apiProcurement) => (dispatch, getState) => {
  const { procurement, payment } = procurementFromApi(apiProcurement)
  const known = getState().purchases.items.find((p) => p.id === procurement.id)
  dispatch(purchaseSaved(procurement))
  if (payment) dispatch(paymentSaved(payment))
  if (procurement.status === 'Paid' && known?.status !== 'Paid') dispatch(receiveStock(procurement))
}

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
