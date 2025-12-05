import { api } from '../../../api/http'

// AI Assistance: role-specific recommendations and questions, answered by the server from the data the role can see
export const AI_ENDPOINTS = {
  recommendations: '/ai/recommendations',
  chat: '/ai/chat'
}

// The AI can take up to a minute or two on a free model
const AI_TIMEOUT_MS = 150000

// Each call returns the API's JSON; failures throw ApiError
export const fetchRecommendations = (refresh = false) => api(`${AI_ENDPOINTS.recommendations}${refresh ? '?refresh=1' : ''}`, { timeoutMs: AI_TIMEOUT_MS })
export const askAssistant = (messages) => api(AI_ENDPOINTS.chat, { method: 'POST', body: { messages }, timeoutMs: AI_TIMEOUT_MS })
