import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { productUpdated } from './productsSlice'
import { stockRowRemoved, stockRowUpdated } from './stockSlice'

// Add Medicine: set a catalog product's prices (applies at every branch)
export const saveMedicinePrices = ({ medId, name, purchasePrice, sellingPrice }) => (dispatch, getState) => {
  const { money } = thunkContext(getState)
  dispatch(productUpdated({ id: medId, changes: { purchasePrice, sellingPrice } }))
  dispatch(logAdded('Product prices set', 'Inventory', medId, `${name}: purchase price ${money(purchasePrice)}, selling price ${money(sellingPrice)}.`))
  return `${name} is ready for sale at ${money(sellingPrice)} per unit.`
}

// Edit one branch's stock row; prices are stored on the product, so they change at every branch
export const editInventoryItem = (item, data) => (dispatch, getState) => {
  const { money, branchName } = thunkContext(getState)
  dispatch(stockRowUpdated({ medId: item.medId, branchId: item.branchId, changes: { stock: data.stock, batch: data.batch, expiry: data.expiry } }))
  dispatch(productUpdated({ id: item.medId, changes: { purchasePrice: data.purchasePrice, sellingPrice: data.sellingPrice } }))
  const changes = [
    data.stock !== item.stock && `stock ${item.stock} → ${data.stock}`,
    data.batch !== item.batch && `batch ${item.batch} → ${data.batch}`,
    data.expiry !== item.expiry && `expiry ${item.expiry} → ${data.expiry}`,
    data.purchasePrice !== item.purchasePrice && `purchase price ${money(item.purchasePrice)} → ${money(data.purchasePrice)}`,
    data.sellingPrice !== item.sellingPrice && `selling price ${item.sellingPrice == null ? 'not set' : money(item.sellingPrice)} → ${money(data.sellingPrice)}`
  ].filter(Boolean)
  const where = `${item.name} at ${branchName(item.branchId)}`
  if (changes.length) dispatch(logAdded('Inventory item updated', 'Inventory', item.medId, `${where}: ${changes.join(', ')}.`))
  return changes.length ? `${where} was updated.` : 'No changes to save.'
}

// Removing a branch's row would make its units vanish without a record, so only empty rows can be deleted
export const deleteInventoryItem = (item) => (dispatch, getState) => {
  const { branchName } = thunkContext(getState)
  const branch = branchName(item.branchId)
  if (item.stock > 0) {
    return { error: `${item.name} at ${branch} still has ${item.stock} units. Sell, transfer, return, or record them as damaged first, then delete the empty row.` }
  }
  dispatch(stockRowRemoved({ medId: item.medId, branchId: item.branchId }))
  dispatch(logAdded('Inventory item deleted', 'Inventory', item.medId, `${item.name} (batch ${item.batch}) removed from ${branch}'s inventory.`))
  return { message: `${item.name} was removed from ${branch}'s inventory.` }
}
