import { updateSellingPrice } from '../api/productsApi'
import { thunkContext } from '../../../redux/thunkHelpers'
import { productUpdated } from './productsSlice'
import { stockRowUpdated } from './stockSlice'

// Edit one branch's stock row; prices are stored on the product, so they change at every branch
export const editInventoryItem = (item, data) => async (dispatch, getState) => {
  // The selling price is the product's at every branch, so it is saved on the server (throws ApiError)
  if (data.sellingPrice !== item.sellingPrice) await updateSellingPrice(item.medId, data.sellingPrice)
  const { money, branchName } = thunkContext(getState)
  dispatch(stockRowUpdated({ medId: item.medId, branchId: item.branchId, batch: item.batch, changes: { stock: data.stock, batch: data.batch, expiry: data.expiry } }))
  dispatch(productUpdated({ id: item.medId, changes: { purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice } }))
  const changes = [
    data.stock !== item.stock && `stock ${item.stock} → ${data.stock}`,
    data.batch !== item.batch && `batch ${item.batch} → ${data.batch}`,
    data.expiry !== item.expiry && `expiry ${item.expiry} → ${data.expiry}`,
    data.purchasePrice !== item.purchasePrice && `purchase price ${money(item.purchasePrice)} → ${money(data.purchasePrice)}`,
    data.sellingPrice !== item.sellingPrice && `selling price ${item.sellingPrice == null ? 'not set' : money(item.sellingPrice)} → ${money(data.sellingPrice)}`
  ].filter(Boolean)
  const where = `${item.name} at ${branchName(item.branchId)}`
  return changes.length ? `${where} was updated.` : 'No changes to save.'
}
