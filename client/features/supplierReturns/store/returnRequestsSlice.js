import { createSlice } from '@reduxjs/toolkit'

// Inventory Officers' requests to send stock back to suppliers (loaded from the API), which of them this browser
// has already taken out of branch stock, and whose supplier replacement it has already put back
const returnRequestsSlice = createSlice({
  name: 'returnRequests',
  initialState: { items: [], heldIds: [], replacedIds: [] },
  reducers: {
    returnRequestsLoaded(state, action) {
      state.items = action.payload
    },
    // Added on top, or replaced when it was approved or rejected
    returnRequestSaved(state, action) {
      const index = state.items.findIndex((r) => r.id === action.payload.id)
      if (index === -1) state.items.unshift(action.payload)
      else state.items[index] = action.payload
    },
    returnStockHeld(state, action) {
      state.heldIds.push(action.payload)
    },
    returnStockReleased(state, action) {
      state.heldIds = state.heldIds.filter((id) => id !== action.payload)
    },
    replacementStocked(state, action) {
      state.replacedIds.push(action.payload)
    }
  }
})

export const { returnRequestsLoaded, returnRequestSaved, returnStockHeld, returnStockReleased, replacementStocked } = returnRequestsSlice.actions
export const selectReturnRequests = (state) => state.returnRequests.items
export const selectHeldReturnIds = (state) => state.returnRequests.heldIds
export default returnRequestsSlice.reducer
