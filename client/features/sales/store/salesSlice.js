import { createSlice } from '@reduxjs/toolkit'

// Sales (loaded from the API), and which of them this browser has already taken out of branch stock
const salesSlice = createSlice({
  name: 'sales',
  initialState: { items: [], appliedIds: [] },
  reducers: {
    salesLoaded(state, action) {
      state.items = action.payload
    },
    // New sales go to the top of the list
    saleSaved(state, action) {
      if (!state.items.some((s) => s.id === action.payload.id)) state.items.unshift(action.payload)
    },
    saleStockApplied(state, action) {
      state.appliedIds.push(action.payload)
    }
  }
})

export const { salesLoaded, saleSaved, saleStockApplied } = salesSlice.actions
export const selectSales = (state) => state.sales.items
export default salesSlice.reducer
