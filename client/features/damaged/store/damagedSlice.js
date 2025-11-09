import { createSlice } from '@reduxjs/toolkit'

const DAMAGED = []

const damagedSlice = createSlice({
  name: 'damaged',
  initialState: DAMAGED,
  reducers: {
    // New records go to the top of the list
    damageRecorded(state, action) {
      state.unshift(action.payload)
    }
  }
})

export const { damageRecorded } = damagedSlice.actions
export const selectDamaged = (state) => state.damaged
export default damagedSlice.reducer
