import { createSlice } from '@reduxjs/toolkit'
import TRANSFERS from '../../../data/transfers.json'

const transfersSlice = createSlice({
  name: 'transfers',
  initialState: TRANSFERS,
  reducers: {
    // New records go to the top of the list
    transferAdded(state, action) {
      state.unshift(action.payload)
    }
  }
})

export const { transferAdded } = transfersSlice.actions
export const selectTransfers = (state) => state.transfers
export default transfersSlice.reducer
