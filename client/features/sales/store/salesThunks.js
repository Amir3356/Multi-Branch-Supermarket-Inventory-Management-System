import { findCatalogProduct } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { createSale, fetchSales } from '../api/salesApi'
import { toSalePayload } from '../model/sale'
import { saleSaved, saleStockApplied, salesLoaded } from './salesSlice'

// Sale thunks call the API; failures throw ApiError

// Each sale takes its units out of its branch's stock once, on every screen
const syncSaleStock = () => (dispatch, getState) => {
  const state = getState()
  for (const sale of state.sales.items) {
    if (state.sales.appliedIds.includes(sale.id)) continue
    const medId = findCatalogProduct(state.products.items, sale.medId, sale.product)?.id
    // The branch's stock arrives in this browser with its procurements and transfers: try again next sync
    if (!medId || !state.stock.some((row) => row.medId === medId && row.branchId === sale.branchId)) continue
    dispatch(stockAdjusted({ medId, branchId: sale.branchId, delta: -sale.qty }))
    dispatch(saleStockApplied(sale.id))
  }
}

export const loadSales = () => async (dispatch) => {
  const { data } = await fetchSales()
  dispatch(salesLoaded(data))
  dispatch(syncSaleStock())
}

// Recorded on another screen at this branch: its stock goes down here too
export const salePushed = (sale) => (dispatch) => {
  dispatch(saleSaved(sale))
  dispatch(syncSaleStock())
}

// Cashier: records a sale at their branch; returns the sale and a confirmation. `idempotencyKey` stays the same for every
// try of one sale, so a retry after a lost response gets the recorded sale back instead of selling it twice.
export const recordSale = (data, idempotencyKey) => async (dispatch, getState) => {
  const { sale } = await createSale(toSalePayload(data), idempotencyKey)
  dispatch(saleSaved(sale))
  dispatch(syncSaleStock())
  const { money, branchName } = thunkContext(getState)
  dispatch(logAdded('Sale recorded', 'Sales', sale.id, `${sale.qty} × ${sale.product} sold to ${sale.customer} at ${branchName(sale.branchId)} for ${money(sale.total)}.`))
  return { sale, message: `Sale ${sale.id} recorded at ${branchName(sale.branchId) || 'your branch'}: ${sale.qty} × ${sale.product} for ${money(sale.total)}.` }
}
