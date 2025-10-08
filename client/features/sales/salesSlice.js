import { createSlice } from '@reduxjs/toolkit'
import SALES from '../../data/sales.json'

const salesSlice = createSlice({
  name: 'sales',
  initialState: SALES,
  reducers: {
    // New records go to the top of the list
    saleAdded(state, action) {
      state.unshift(action.payload)
    }
  }
})

export const { saleAdded } = salesSlice.actions
export const selectSales = (state) => state.sales
export default salesSlice.reducer
