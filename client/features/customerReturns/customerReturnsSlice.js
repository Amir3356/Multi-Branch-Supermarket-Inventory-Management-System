import { createSlice } from '@reduxjs/toolkit'
import CUSTOMER_RETURNS from '../../data/customerReturns.json'

const customerReturnsSlice = createSlice({
  name: 'customerReturns',
  initialState: CUSTOMER_RETURNS,
  reducers: {
    // New records go to the top of the list
    customerReturnRecorded(state, action) {
      state.unshift(action.payload)
    }
  }
})

export const { customerReturnRecorded } = customerReturnsSlice.actions
export const selectCustomerReturns = (state) => state.customerReturns
export default customerReturnsSlice.reducer
