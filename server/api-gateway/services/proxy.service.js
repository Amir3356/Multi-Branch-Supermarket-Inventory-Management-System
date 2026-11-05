import { createProxyMiddleware } from 'http-proxy-middleware'
import { config, logger } from '../utils/index.js'

// A down service answers 502 in the client's error shape instead of a bare socket error
function onProxyError(name) {
  return (error, req, res) => {
    logger.error(`Proxy to ${name} failed`, { path: req.url, error: error.message })
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: `The ${name} service is unavailable right now. Try again shortly.` }))
    }
  }
}

/** One proxy per service. Mounted under /api, so req.url no longer has the prefix: /api/sales/… is sent on as /sales/… */
export const serviceProxies = Object.fromEntries(
  Object.entries(config.services).map(([name, target]) => [
    name,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      xfwd: true,
      // AI answers can take as long as the model's own timeout
      proxyTimeout: name === 'ai' ? (config.openrouter.timeout + 15) * 1000 : 60_000,
      on: { error: onProxyError(name) },
    }),
  ]),
)

/** Live updates: Socket.IO handshakes, polling and WebSocket upgrades go to notification-service */
export const realtimeProxy = createProxyMiddleware({
  target: config.services.notification,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  pathFilter: '/socket.io',
  on: { error: onProxyError('notification') },
})

/** Health of every service, by calling each one's /health */
export async function servicesHealth() {
  const checks = await Promise.all(
    Object.entries(config.services).map(async ([name, url]) => {
      try {
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2_000) })
        return [name, response.ok ? 'ok' : `unhealthy (${response.status})`]
      } catch {
        return [name, 'unreachable']
      }
    }),
  )
  return Object.fromEntries(checks)
}
