import { Server } from 'socket.io'
import { isInternalSecret, logger } from '../utils/index.js'
import { AUDIT_ENTRY } from '../middleware/validators/auditLog.validator.js'
import { record } from './auditLog.service.js'

/**
 * The audit WebSocket: every other service keeps one Socket.IO connection here and pushes its audit entries from its
 * outbox ('audit:record'). Each entry is validated, stored, and acknowledged with { ok: true, id }; the sender removes
 * it from its outbox only after that. A repeat of an entry already stored (same sourceKey) is acknowledged with the
 * stored id and not written twice.
 *
 * Service-to-service only: the path is under /internal (the gateway refuses it) and the handshake must carry
 * INTERNAL_SERVICE_SECRET.
 */
export function attachAuditSocket(server) {
  const io = new Server(server, { path: '/internal/audit-socket', serveClient: false, transports: ['websocket'] })

  io.use((socket, next) => {
    if (isInternalSecret(socket.handshake.auth?.secret)) return next()
    next(new Error('Not allowed'))
  })

  io.on('connection', (socket) => {
    const from = String(socket.handshake.auth?.service ?? 'a service')
    logger.info(`Audit connection from ${from}`)

    socket.on('audit:record', async (entry, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {}
      const parsed = AUDIT_ENTRY.safeParse(entry)
      if (!parsed.success) {
        logger.error('Audit entry refused: invalid', { from, error: parsed.error.message })
        return reply({ ok: false, invalid: true, error: parsed.error.issues.map((i) => i.message).join(' ') })
      }
      try {
        reply({ ok: true, id: await record(parsed.data) })
      } catch (error) {
        logger.error('Audit entry not stored', { from, module: parsed.data.module, action: parsed.data.action, error: error.message })
        reply({ ok: false, error: 'Could not store the entry right now.' })
      }
    })

    socket.on('disconnect', (reason) => logger.info(`Audit connection from ${from} closed (${reason})`))
  })

  return io
}
