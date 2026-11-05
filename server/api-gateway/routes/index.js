import { health, notFound, up } from '../controllers/health.controller.js'
import { corsPolicy } from '../middleware/index.js'
import { realtimeProxy } from '../services/proxy.service.js'
import { apiRouter } from './api.routes.js'

/**
 *   /health     → this gateway plus every service
 *   /api/*      → authenticated, then proxied to the service that owns the path (models/route.model.js)
 *   /socket.io  → proxied to notification-service for live updates
 */
export function registerRoutes(app) {
  app.use(corsPolicy)
  app.get('/health', health)
  app.get('/up', up)
  app.use('/api', apiRouter)
  app.use(realtimeProxy)
  app.use(notFound)
}
