import { createSlice } from '@reduxjs/toolkit'
import BRANCH_STOCK from '../../../data/branchStock.json'

const findRow = (state, medId, branchId) => state.find((e) => e.medId === medId && e.branchId === branchId)

// Each branch's quantity, batch and expiry for each product
const stockSlice = createSlice({
  name: 'stock',
  initialState: BRANCH_STOCK,
  reducers: {
    // Add (positive) or remove (negative) units at one branch
    stockAdjusted(state, action) {
      const { medId, branchId, delta } = action.payload
      const row = findRow(state, medId, branchId)
      if (row) row.stock += delta
    },
    // Units arriving at a branch: added to its row, or a new row if the branch didn't stock the product. The row moves
    // to the top, so the latest stock shows first in Inventory.
    stockReceived(state, action) {
      const { medId, branchId, qty, batch, expiry } = action.payload
      const row = findRow(state, medId, branchId)
      const updated = row ? { ...row, stock: row.stock + qty } : { medId, branchId, stock: qty, batch, expiry }
      return [updated, ...state.filter((e) => e !== row)]
    },
    stockRowUpdated(state, action) {
      const { medId, branchId, changes } = action.payload
      const row = findRow(state, medId, branchId)
      if (row) Object.assign(row, changes)
    },
    stockRowRemoved(state, action) {
      const { medId, branchId } = action.payload
      return state.filter((e) => !(e.medId === medId && e.branchId === branchId))
    }
  }
})

export const { stockAdjusted, stockReceived, stockRowUpdated, stockRowRemoved } = stockSlice.actions
export const selectStockLevels = (state) => state.stock
export default stockSlice.reducer
