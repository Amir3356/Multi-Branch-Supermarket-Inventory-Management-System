import { nextId, todayKey, yearsFromToday } from '../../utils'
import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { categoryAdded, productAdded } from '../inventory/productsSlice'
import { stockReceived } from '../inventory/stockSlice'
import { purchaseAdded } from './purchasesSlice'

// Records a purchase and adds the bought quantity to the receiving branch's stock.
// A product typed into the purchase joins the catalog; its selling price is set later with Add Medicine.
export const createPurchase = ({ medId: knownMedId, purchasePrice, ...data }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const purchase = { id: nextId(state.purchases.items, 'PO'), ...data, date: todayKey(), status: 'Paid' }
  let medId = knownMedId
  dispatch(categoryAdded(data.category))
  if (!medId) {
    medId = nextId(state.products.items, 'MED')
    dispatch(productAdded({ id: medId, name: data.product, category: data.category, purchasePrice, sellingPrice: null, reorderLevel: state.settings.defaultMinStock }))
  }
  dispatch(purchaseAdded(purchase))
  // A product new to this branch gets the purchase ID as its batch and a default two-year expiry
  dispatch(stockReceived({ medId, branchId: data.branchId, qty: data.qty, batch: purchase.id, expiry: yearsFromToday(2) }))
  dispatch(logAdded('Purchase created', 'Purchase', purchase.id, `${data.qty} × ${data.product} bought from ${data.supplier} into ${branchName(data.branchId)} for ${money(data.total)}.`))
  if (!knownMedId) dispatch(logAdded('Product added', 'Inventory', medId, `${data.product} added to ${data.category} through purchase ${purchase.id} (purchase price ${money(purchasePrice)}).`))
  return {
    purchase,
    message: `Purchase ${purchase.id} created: ${data.qty} × ${data.product} from ${data.supplier} received into ${branchName(data.branchId)} for ${money(data.total)}.${knownMedId ? '' : ' New product added to Inventory: set its selling price with Add Medicine.'}`
  }
}
