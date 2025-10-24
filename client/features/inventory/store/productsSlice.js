import { createSlice } from '@reduxjs/toolkit'
import MEDICINES from '../../../data/medicines.json'
import CATEGORIES from '../../../data/categories.json'

// The product catalog shared by every branch, plus its categories
const productsSlice = createSlice({
  name: 'products',
  initialState: { items: MEDICINES, categories: CATEGORIES },
  reducers: {
    productAdded(state, action) {
      state.items.push(action.payload)
    },
    productUpdated(state, action) {
      const product = state.items.find((p) => p.id === action.payload.id)
      if (product) Object.assign(product, action.payload.changes)
    },
    categoryAdded(state, action) {
      if (!state.categories.includes(action.payload)) state.categories.push(action.payload)
    }
  }
})

export const { productAdded, productUpdated, categoryAdded } = productsSlice.actions
export const selectProducts = (state) => state.products.items
export const selectCategories = (state) => state.products.categories
export default productsSlice.reducer
