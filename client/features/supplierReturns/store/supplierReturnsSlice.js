import { createSlice } from '@reduxjs/toolkit'
import SUPPLIER_RETURNS from '../../../data/supplierReturns.json'

const supplierReturnsSlice = createSlice({
  name: 'supplierReturns',
  initialState: SUPPLIER_RETURNS,
  reducers: {
    // New records go to the top of the list
    supplierReturnRecorded(state, action) {
      state.unshift(action.payload)
    },
    // The supplier sent good units in place of (part of) the return
    supplierReturnReplaced(state, action) {
      const record = state.find((r) => r.requestId === action.payload.requestId)
      if (record) record.replacedQty = action.payload.replacedQty
    }
  }
})

export const { supplierReturnRecorded, supplierReturnReplaced } = supplierReturnsSlice.actions
export const selectSupplierReturns = (state) => state.supplierReturns
export default supplierReturnsSlice.reducer
