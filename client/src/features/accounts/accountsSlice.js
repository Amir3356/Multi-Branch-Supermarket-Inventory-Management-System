import { createSlice } from '@reduxjs/toolkit'
import ACCOUNTS from '../../data/accounts.json'

// Staff login accounts (Owner, Pharmacist, Cashier, Purchase Officer)
const accountsSlice = createSlice({
  name: 'accounts',
  initialState: ACCOUNTS,
  reducers: {
    accountAdded(state, action) {
      state.push(action.payload)
    },
    accountUpdated(state, action) {
      const account = state.find((a) => a.id === action.payload.id)
      if (account) Object.assign(account, action.payload.changes)
    },
    accountRemoved(state, action) {
      return state.filter((a) => a.id !== action.payload)
    }
  }
})

export const { accountAdded, accountUpdated, accountRemoved } = accountsSlice.actions
export const selectAccounts = (state) => state.accounts
export default accountsSlice.reducer
