import { api } from '../../../api/http'

// Sales endpoints: the Cashier records sales at their branch
export const SALES_ENDPOINTS = { list: '/sales' }

// Each call returns the API's JSON; failures throw ApiError
export const fetchSales = () => api(SALES_ENDPOINTS.list)
export const createSale = (payload) => api(SALES_ENDPOINTS.list, { method: 'POST', body: payload })
