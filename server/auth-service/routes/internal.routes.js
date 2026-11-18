import { Router } from '../utils/index.js'
import * as internal from '../controllers/internal.controller.js'

/** Service-to-service (never routed by the gateway) */
export const internalRouter = Router()

// The nginx gateway's auth_request (see api-gateway/nginx.conf)
internalRouter.get('/internal/auth/gateway-check', internal.gatewayCheck)
