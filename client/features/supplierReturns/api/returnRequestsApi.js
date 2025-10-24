import { api } from '../../../api/http'

// Return request endpoints: the Inventory Officer sends, the Procurement Officer approves or rejects
export const RETURN_REQUESTS_ENDPOINTS = {
  list: '/return-requests',
  approve: (id) => `/return-requests/${id}/approve`,
  reject: (id) => `/return-requests/${id}/reject`,
  replace: (id) => `/return-requests/${id}/replace`
}

// Each call returns the API's JSON; failures throw ApiError
export const fetchReturnRequests = () => api(RETURN_REQUESTS_ENDPOINTS.list)
export const createReturnRequest = (payload) => api(RETURN_REQUESTS_ENDPOINTS.list, { method: 'POST', body: payload })
export const approveReturnRequestRequest = (id) => api(RETURN_REQUESTS_ENDPOINTS.approve(id), { method: 'POST' })
export const rejectReturnRequestRequest = (id, responseNote) => api(RETURN_REQUESTS_ENDPOINTS.reject(id), { method: 'POST', body: { responseNote } })
export const replaceReturnRequestRequest = (id, payload) => api(RETURN_REQUESTS_ENDPOINTS.replace(id), { method: 'POST', body: payload })
