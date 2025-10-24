import { api } from '../../../api/http'

// Access review report endpoints (Owner only)
export const ACCESS_REVIEWS_ENDPOINTS = {
  list: '/access-reviews',
  review: (id) => `/access-reviews/${id}`
}

// Plain API helpers: the reports are only used on this page
export const fetchAccessReviews = () => api(ACCESS_REVIEWS_ENDPOINTS.list).then((r) => r.data)
export const fetchAccessReview = (id) => api(ACCESS_REVIEWS_ENDPOINTS.review(id)).then((r) => r.data)
export const deleteAccessReview = (id) => api(ACCESS_REVIEWS_ENDPOINTS.review(id), { method: 'DELETE' })
// period: daily | weekly | monthly | quarterly | yearly (the current period so far), or custom with from/to (YYYY-MM-DD)
// scope: 'current' = this period so far (Partial), 'previous' = the last finished one (Complete)
export const generateAccessReview = (period, from, to, scope = 'current') =>
  api(ACCESS_REVIEWS_ENDPOINTS.list, { method: 'POST', body: period === 'custom' ? { period, from, to } : { period, scope } })
