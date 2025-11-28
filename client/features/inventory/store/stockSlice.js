import { createSlice } from '@reduxjs/toolkit'
import { fifoBatches } from '../../../utils/stock'

const BRANCH_STOCK = []

const findRow = (state, medId, branchId, batch) => state.find((e) => e.medId === medId && e.branchId === branchId && e.batch === batch)

// Each branch's stock, one row per batch of a product: { medId, branchId, batch, expiry, stock, receivedAt }
const stockSlice = createSlice({
  name: 'stock',
  initialState: BRANCH_STOCK,
  reducers: {
    // Takes units out of (negative delta) or back into one batch. A batch this browser doesn't know (renamed, or older
    // data without batches) gives up its units first-in, first-out from the product's batches instead.
    stockAdjusted(state, action) {
      const { medId, branchId, batch, delta } = action.payload
      const row = findRow(state, medId, branchId, batch)
      if (row || delta > 0) {
        if (row) row.stock += delta
        return
      }
      const rows = state.filter((e) => e.medId === medId && e.branchId === branchId)
      // Not-expired batches oldest first, then anything else, so the units always come off somewhere
      const order = [...fifoBatches(rows), ...rows.filter((r) => !fifoBatches(rows).includes(r))]
      let left = -delta
      for (const r of order) {
        if (left <= 0) break
        const units = Math.min(left, Math.max(0, r.stock))
        r.stock -= units
        left -= units
      }
      if (left > 0 && order.length) order[0].stock -= left
    },
    // Units arriving at a branch under a batch: added to that batch, or a new batch row. The row moves to the top, so
    // the latest stock shows first in Inventory.
    stockReceived(state, action) {
      const { medId, branchId, qty, batch, expiry, receivedAt } = action.payload
      const row = findRow(state, medId, branchId, batch)
      const updated = row ? { ...row, stock: row.stock + qty } : { medId, branchId, batch, expiry, stock: qty, receivedAt: receivedAt || new Date().toISOString() }
      return [updated, ...state.filter((e) => e !== row)]
    },
    stockRowUpdated(state, action) {
      const { medId, branchId, batch, changes } = action.payload
      const row = findRow(state, medId, branchId, batch)
      if (row) Object.assign(row, changes)
    }
  }
})

export const { stockAdjusted, stockReceived, stockRowUpdated } = stockSlice.actions
export const selectStockLevels = (state) => state.stock
export default stockSlice.reducer
