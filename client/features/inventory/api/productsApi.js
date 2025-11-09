import { api } from '../../../api/http'

// The product catalog, shared by every branch
export const PRODUCTS_ENDPOINTS = {
  list: '/products',
  sellingPrice: (id) => `/products/${encodeURIComponent(id)}/selling-price`
}

// Returns the API's JSON; failures throw ApiError
export const fetchProducts = () => api(PRODUCTS_ENDPOINTS.list)

// Inventory Officer: a product's unit selling price, at every branch
export const updateSellingPrice = (id, sellingPrice) => api(PRODUCTS_ENDPOINTS.sellingPrice(id), { method: 'PUT', body: { sellingPrice } })
