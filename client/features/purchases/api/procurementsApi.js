import { api } from '../../../api/http'

// Procurement endpoints (paid through Chapa)
export const PROCUREMENTS_ENDPOINTS = {
  list: '/procurements',
  verify: (id) => `/procurements/${encodeURIComponent(id)}/verify`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchProcurements = () => api(PROCUREMENTS_ENDPOINTS.list)
export const createProcurement = (data) => api(PROCUREMENTS_ENDPOINTS.list, { method: 'POST', body: data })
export const verifyProcurementPayment = (id) => api(PROCUREMENTS_ENDPOINTS.verify(id), { method: 'POST' })
