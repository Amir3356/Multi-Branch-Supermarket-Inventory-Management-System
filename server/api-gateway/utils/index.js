// Shared helpers of the gateway (it has no database: config, logging, identity headers, calls to services)
export { config } from './config.js'
export { logger } from './logger.js'
export { HttpError } from './errors.js'
export { HEADERS, encodeContext, decodeContext, isInternalSecret, forwardHeaders } from './context.js'
export { serviceClient } from './serviceClient.js'
export { bearerToken, parseTrustedProxies } from './http.js'
