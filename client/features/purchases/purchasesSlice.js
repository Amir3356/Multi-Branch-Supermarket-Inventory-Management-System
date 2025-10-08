import { createSlice } from '@reduxjs/toolkit'
import PURCHASES from '../../data/purchases.json'
import PAYMENTS from '../../data/supplierPayments.json'

// Purchases from suppliers and the payments that settle them
const purchasesSlice = createSlice({
  name: 'purchases',
  initialState: { items: PURCHASES, payments: PAYMENTS },
  reducers: {
    purchaseAdded(state, action) {
      state.items.unshift(action.payload)
    }
  }
})

export const { purchaseAdded } = purchasesSlice.actions
export const selectPurchases = (state) => state.purchases.items
export const selectSupplierPayments = (state) => state.purchases.payments
export default purchasesSlice.reducer
