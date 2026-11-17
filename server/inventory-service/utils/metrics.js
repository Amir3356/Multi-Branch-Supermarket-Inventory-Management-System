import client from 'prom-client'

/**
 * Monitoring metrics (Prometheus format), read by Prometheus from GET /metrics and shown in Grafana
 * (server/monitoring). Every metric carries this service's name as the `service` label.
 *
 *   http_requests_total / http_request_duration_seconds   traffic, errors and response times per route
 *   cache_requests_total{result}                          Redis cache hits, misses and errors
 *   kafka_messages_total{topic,direction,result}          events produced to / consumed from Kafka
 *   audit_outbox_pending                                   audit entries waiting to be streamed (events.js)
 *   plus Node.js process metrics: memory, CPU, event-loop delay, garbage collection
 */
export const registry = new client.Registry()

let started = false

/** Names the service and starts the Node.js process metrics (createService calls it) */
export function initMetrics(serviceName) {
  if (started) return
  started = true
  registry.setDefaultLabels({ service: serviceName })
  client.collectDefaultMetrics({ register: registry })
}

export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled, by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
})

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'How long HTTP requests took, by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

export const cacheRequests = new client.Counter({
  name: 'cache_requests_total',
  help: 'Redis cache lookups: hit, miss, or error (fell back to the database)',
  labelNames: ['result'],
  registers: [registry],
})

export const kafkaMessages = new client.Counter({
  name: 'kafka_messages_total',
  help: 'Kafka messages produced or consumed, by topic and result',
  labelNames: ['topic', 'direction', 'result'],
  registers: [registry],
})

/** A gauge whose value is read when Prometheus scrapes (e.g. a count from the database) */
export function gauge(name, help, read) {
  return new client.Gauge({
    name,
    help,
    registers: [registry],
    async collect() {
      try {
        this.set(await read())
      } catch {
        // Unknown this time (e.g. the database is down); the previous value stays
      }
    },
  })
}

/**
 * Times every request and counts it by route. The route is the matched pattern (/branches/:branch), never the raw
 * URL, so ids don't create a new series each; anything unmatched is counted as "unmatched".
 */
export function metricsMiddleware(req, res, next) {
  // Prometheus's own scrapes and health checks aren't API traffic
  if (req.path === '/metrics' || req.path === '/health') return next()
  const end = httpDuration.startTimer()
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched'
    const labels = { method: req.method, route, status: String(res.statusCode) }
    end(labels)
    httpRequests.inc(labels)
  })
  next()
}

/** GET /metrics: everything above, in Prometheus's text format */
export async function metricsHandler(req, res) {
  res.set('Content-Type', registry.contentType)
  res.end(await registry.metrics())
}
