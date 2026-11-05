import { servicesHealth } from '../services/proxy.service.js'

/** GET /health: the gateway plus every service; 503 when any is down */
export async function health(req, res) {
  const services = await servicesHealth()
  const healthy = Object.values(services).every((status) => status === 'ok')
  res.status(healthy ? 200 : 503).json({ gateway: 'ok', services })
}

/** GET /up: kept for old clients (Laravel's health check) */
export function up(req, res) {
  res.json({ status: 'ok' })
}

export function notFound(req, res) {
  res.status(404).json({ message: 'Not found.' })
}
