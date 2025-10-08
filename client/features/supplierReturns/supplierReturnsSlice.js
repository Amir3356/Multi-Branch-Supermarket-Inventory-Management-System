import { createSlice } from '@reduxjs/toolkit'
import SUPPLIER_RETURNS from '../../data/supplierReturns.json'

const supplierReturnsSlice = createSlice({
  name: 'supplierReturns',
  initialState: SUPPLIER_RETURNS,
  reducers: {
    // New records go to the top of the list
    supplierReturnRecorded(state, action) {
      state.unshift(action.payload)
    }
  }
})

export const { supplierReturnRecorded } = supplierReturnsSlice.actions
export const selectSupplierReturns = (state) => state.supplierReturns
export default supplierReturnsSlice.reducer
