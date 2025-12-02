import { findCatalogProduct } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { createDamagedItem, fetchDamagedItems } from '../api/damagedApi'
import { toDamagePayload } from '../model/damageRecord'
import { damageSaved, damageStockApplied, damagedLoaded } from './damagedSlice'

// Damaged stock is written off: it leaves the branch's sellable stock and is kept as a loss record. Thunks call the API;
// failures throw ApiError

// Each write-off takes its units out of its branch's batch once, on every screen
const syncDamageStock = () => (dispatch, getState) => {
  const state = getState()
  for (const item of [...state.damaged.items].reverse()) {
    if (state.damaged.appliedIds.includes(item.id)) continue
    const medId = findCatalogProduct(state.products.items, item.medId, item.product)?.id
    // The branch's stock arrives in this browser with its procurements and transfers: try again next sync
    if (!medId || !state.stock.some((row) => row.medId === medId && row.branchId === item.branchId)) continue
    dispatch(stockAdjusted({ medId, branchId: item.branchId, batch: item.batch, delta: -item.qty }))
    dispatch(damageStockApplied(item.id))
  }
}

export const loadDamaged = () => async (dispatch) => {
  const { data } = await fetchDamagedItems()
  dispatch(damagedLoaded(data))
  dispatch(syncDamageStock())
}

// Recorded on another screen at this branch: its stock goes down here too
export const damagePushed = (item) => (dispatch) => {
  dispatch(damageSaved(item))
  dispatch(syncDamageStock())
}

// Inventory Officer: writes off damaged units from one batch at their branch
export const recordDamage = (data) => async (dispatch, getState) => {
  const { damagedItem } = await createDamagedItem(toDamagePayload(data))
  dispatch(damageSaved(damagedItem))
  dispatch(syncDamageStock())
  const { money, branchName } = thunkContext(getState)
  return `${damagedItem.id} recorded: ${damagedItem.qty} × ${damagedItem.product} removed from ${branchName(damagedItem.branchId)} stock (${money(damagedItem.lossValue)} loss).`
}
