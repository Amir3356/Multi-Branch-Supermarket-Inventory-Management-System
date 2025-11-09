import { fetchProducts } from '../api/productsApi'
import { productsLoaded } from './productsSlice'

// The product catalog from the server: loaded first, since procurements, transfers and sales refer to its products
export const loadProducts = () => async (dispatch) => {
  const { data } = await fetchProducts()
  dispatch(productsLoaded(data))
}

// Prices changed on another screen (stock added, or a selling price edited): reload the catalog
export const productsPushed = () => (dispatch) => dispatch(loadProducts()).catch(() => {})
