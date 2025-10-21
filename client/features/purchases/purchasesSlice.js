import { createSlice } from '@reduxjs/toolkit'
import PURCHASES from '../../data/purchases.json'
import PAYMENTS from '../../data/supplierPayments.json'

const upsert = (list, record) => {
  const index = list.findIndex((item) => item.id === record.id)
  if (index === -1) list.unshift(record)
  else list[index] = record
}

// Purchases from suppliers and the payments that settle them
const purchasesSlice = createSlice({
  name: 'purchases',
  initialState: { items: PURCHASES, payments: PAYMENTS },
  reducers: {
    // Added, or replaced when the API sends a newer copy (e.g. Pending → Paid)
    purchaseSaved(state, action) {
      upsert(state.items, action.payload)
    },
    paymentSaved(state, action) {
      upsert(state.payments, action.payload)
    }
  }
})

export const { purchaseSaved, paymentSaved } = purchasesSlice.actions
export const selectPurchases = (state) => state.purchases.items
export const selectSupplierPayments = (state) => state.purchases.payments
export default purchasesSlice.reducer
