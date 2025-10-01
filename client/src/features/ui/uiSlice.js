import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, readText } from '../../utils'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: readText(STORAGE_KEYS.theme) === 'light' ? 'light' : 'dark',
    // Branch shown by the list pages (Inventory, Sales, …): "all" or a branch id
    selectedBranch: 'all'
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
    },
    selectedBranchChanged(state, action) {
      state.selectedBranch = action.payload
    }
  }
})

export const { toggleTheme, selectedBranchChanged } = uiSlice.actions
export const selectTheme = (state) => state.ui.theme
export const selectSelectedBranch = (state) => state.ui.selectedBranch
export default uiSlice.reducer
