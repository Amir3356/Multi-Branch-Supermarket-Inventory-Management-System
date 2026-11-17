// docker-info-exporter: per-container facts Prometheus can't get from cAdvisor on this Docker (it uses the containerd
// image store, which cAdvisor can't read container names or network stats from):
//   docker_container_info{container_id="<12 hex>", name="server-auth-service-1", service="auth-service"} 1
//       which container id is which compose service (cAdvisor's CPU / memory are joined on container_id)
//   docker_container_network_{receive,transmit}_{bytes,packets,errors,dropped}_total{service, name}
//       each container's network traffic, from the Docker Engine stats API
import http from 'node:http'

const PROJECT = process.env.COMPOSE_PROJECT || 'server'
const PORT = Number(process.env.PORT || 9417)

// GET on the Docker Engine API over its unix socket (mounted read-only)
const docker = (path) =>
  new Promise((resolve, reject) => {
    const req = http.request({ socketPath: '/var/run/docker.sock', path, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`Docker API ${res.statusCode}`))))
    })
    req.on('error', reject)
    req.end()
  })

const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')

http
  .createServer(async (req, res) => {
    if (req.url !== '/metrics') return res.writeHead(404).end()
    try {
      const filter = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${PROJECT}`] }))
      const containers = await docker(`/containers/json?filters=${filter}`)
      const lines = ['# HELP docker_container_info Compose service of each running container (value is always 1)', '# TYPE docker_container_info gauge']
      const rows = await Promise.all(
        containers.map(async (c) => {
          const service = c.Labels?.['com.docker.compose.service'] ?? ''
          const name = (c.Names?.[0] ?? '').replace(/^\//, '')
          // one-shot: the current counters, without waiting for a second sample
          const stats = await docker(`/containers/${c.Id}/stats?stream=false&one-shot=true`).catch(() => null)
          return { id: c.Id.slice(0, 12), service, name, nets: stats?.networks ?? {} }
        }),
      )
      for (const { id, service, name } of rows) {
        lines.push(`docker_container_info{container_id="${id}",name="${escape(name)}",service="${escape(service)}"} 1`)
      }
      const FIELDS = { rx_bytes: 'receive_bytes', tx_bytes: 'transmit_bytes', rx_packets: 'receive_packets', tx_packets: 'transmit_packets', rx_errors: 'receive_errors', tx_errors: 'transmit_errors', rx_dropped: 'receive_dropped', tx_dropped: 'transmit_dropped' }
      for (const [field, metric] of Object.entries(FIELDS)) {
        lines.push(`# TYPE docker_container_network_${metric}_total counter`)
        for (const { service, name, nets } of rows) {
          const total = Object.values(nets).reduce((sum, n) => sum + (Number(n[field]) || 0), 0)
          lines.push(`docker_container_network_${metric}_total{name="${escape(name)}",service="${escape(service)}"} ${total}`)
        }
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' }).end(lines.join('\n') + '\n')
    } catch (error) {
      res.writeHead(500).end(`# ${error.message}\n`)
    }
  })
  .listen(PORT, () => console.log(`docker-info-exporter on :${PORT}`))
