import { createSlice } from '@reduxjs/toolkit'
import BRANCHES from '../../data/branches.json'

const branchesSlice = createSlice({
  name: 'branches',
  initialState: BRANCHES,
  reducers: {
    branchAdded(state, action) {
      state.push(action.payload)
    },
    branchUpdated(state, action) {
      const branch = state.find((b) => b.id === action.payload.id)
      if (branch) Object.assign(branch, action.payload.changes)
    },
    branchRemoved(state, action) {
      return state.filter((b) => b.id !== action.payload)
    }
  }
})

export const { branchAdded, branchUpdated, branchRemoved } = branchesSlice.actions
export const selectBranches = (state) => state.branches
export default branchesSlice.reducer
