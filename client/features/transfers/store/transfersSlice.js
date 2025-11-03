import { createSlice } from '@reduxjs/toolkit'

// Stock transfers between branches (loaded from the API), and which of their stock moves this browser has applied:
// leaving the sending branch (sentIds) and entering the receiving one (receivedIds)
const transfersSlice = createSlice({
  name: 'transfers',
  initialState: { items: [], sentIds: [], receivedIds: [] },
  reducers: {
    transfersLoaded(state, action) {
      state.items = action.payload
    },
    // Added on top, or replaced when it was received
    transferSaved(state, action) {
      const index = state.items.findIndex((t) => t.id === action.payload.id)
      if (index === -1) state.items.unshift(action.payload)
      else state.items[index] = action.payload
    },
    transferSentApplied(state, action) {
      state.sentIds.push(action.payload)
    },
    transferReceivedApplied(state, action) {
      state.receivedIds.push(action.payload)
    }
  }
})

export const { transfersLoaded, transferSaved, transferSentApplied, transferReceivedApplied } = transfersSlice.actions
export const selectTransfers = (state) => state.transfers.items
export default transfersSlice.reducer
