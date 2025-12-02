import { createSlice } from '@reduxjs/toolkit'

// Damaged items (loaded from the API), and which of them this browser has already taken out of branch stock
const damagedSlice = createSlice({
  name: 'damaged',
  initialState: { items: [], appliedIds: [] },
  reducers: {
    damagedLoaded(state, action) {
      state.items = action.payload
    },
    // New records go to the top of the list
    damageSaved(state, action) {
      if (!state.items.some((d) => d.id === action.payload.id)) state.items.unshift(action.payload)
    },
    damageStockApplied(state, action) {
      state.appliedIds.push(action.payload)
    }
  }
})

export const { damagedLoaded, damageSaved, damageStockApplied } = damagedSlice.actions
export const selectDamaged = (state) => state.damaged.items
export default damagedSlice.reducer
