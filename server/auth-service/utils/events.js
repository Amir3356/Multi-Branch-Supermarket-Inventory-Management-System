import { io } from 'socket.io-client'
import { config } from './config.js'
import { pool } from './db.js'
import { logger } from './logger.js'
import { serviceClient } from './serviceClient.js'

/**
 * Side effects owned by other services, sent fire-and-forget: a stopped notification or reporting service never slows
 * or breaks the action that triggered them. Audit entries also survive a stopped reporting-service (see audit()).
 * Inside a transaction, call them from client.afterCommit(() => ...) so a rolled-back change is never announced.
 */

/**
 * Pushes a live update to every browser subscribed to a channel (notification-service, Socket.IO).
 *   broadcast('branch.BR-01.sales', 'sale.recorded', { sale })
 * The client listens with realtime().private('branch.BR-01.sales').listen('.sale.recorded', handler).
 */
export function broadcast(channel, event, data = {}) {
  serviceClient('notification')
    .post('/internal/broadcast', { channel, event, data }, { timeoutMs: 5_000 })
    .catch((error) => logger.warn('Live update not sent', { channel, event, error: error.message }))
}

/**
 * Records an action in the audit log: who (the signed-in user, unless `actor` is given), from which IP and device, on
 * which branch, what happened, and when. Call it right after the action succeeds. Never throws.
 *
 *   audit(req, { module: 'Sales', action: 'Recorded sale', recordId: sale.id, description: '…', branchId })
 *
 * actor:      { id, fullName, role } when it isn't the signed-in user (e.g. a sign-in before there is a session)
 * actorName:  a name with no account behind it (the email typed at a failed sign-in, or 'Chapa' for the system)
 * branchName: only for a branch that no longer exists (just deleted), whose name can't be looked up
 * type:       create | update | delete | approve | reject | view | login | logout | other; left out, reporting-service
 *             works it out from the action ("Branch added" → create)
 * before:     the record as it was (updates, deletes); after: as it is now (creates, updates). Plain objects or rows;
 *             reporting-service strips secrets (passwords, tokens) before storing them.
 *
 * Delivery is durable (a transactional outbox): the entry is first saved in this database's audit_outbox table, then
 * pushed to reporting-service over a WebSocket and removed once reporting-service acknowledges it is stored. A stopped or slow reporting-service only delays
 * entries; nothing is lost, and the time recorded is when the action happened, not when it was delivered.
 */
export function audit(req, { module, action, recordId = null, description, branchId = null, actor = null, actorName = null, branchName = null, type = null, before = null, after = null }) {
  const who = actor ?? req?.user ?? null
  const entry = {
    module,
    action,
    recordId: recordId === null || recordId === undefined ? null : String(recordId),
    description,
    branchId,
    branchName,
    actor: who ? { id: who.id, fullName: who.fullName, role: who.role } : null,
    actorName,
    type,
    before: snapshot(before),
    after: snapshot(after),
    ip: req?.clientIp ?? null,
    userAgent: req?.userAgent ?? null,
    occurredAt: new Date().toISOString(),
  }
  saveToOutbox(entry)
}

// ---- Audit outbox relay (WebSocket) -------------------------------------------------------------------------------
//
// Entries go to reporting-service over one Socket.IO connection per service (path /internal/audit-socket, which the
// gateway never exposes; the handshake carries INTERNAL_SERVICE_SECRET). Each entry is acknowledged once stored, and
// only then removed from the outbox. Nothing polls: an entry is pushed the moment it is saved, and whatever waited
// while reporting-service was down is pushed the moment the connection comes back.

const OUTBOX_BATCH = 50
const ACK_TIMEOUT_MS = 5_000
const RETRY_MAX_MS = 30_000
// After reporting-service refused an entry (e.g. its database hiccuped) while the connection stayed up
const REFUSED_RETRY_MS = 10_000
// Entries that couldn't even be saved to the outbox (database unreachable for a moment): kept here and retried
const unsaved = []
let socket = null
let relaying = false
let relayAgain = false
let refusedRetry = null

// This service's name (createService passes it to startAuditRelay); the outbox keeps each service's entries apart
let outboxName = 'service'
const outboxService = () => outboxName

const OUTBOX_INSERT = 'insert into audit_outbox (service, payload) values ($1, $2::jsonb)'

function saveToOutbox(entry, attempt = 0) {
  pool
    .query(OUTBOX_INSERT, [outboxService(), JSON.stringify(entry)])
    .then(() => relayAuditsSoon())
    .catch((error) => {
      // Never drop it: keep it in memory and keep trying (the action already happened)
      if (attempt === 0) logger.error('Audit entry not saved to the outbox yet, retrying', { module: entry.module, action: entry.action, error: error.message })
      if (attempt === 0) unsaved.push(entry)
      setTimeout(() => retryUnsaved(), Math.min(RETRY_MAX_MS, 1_000 * 2 ** Math.min(attempt, 6))).unref?.()
    })
}

let retryingUnsaved = false
async function retryUnsaved() {
  if (retryingUnsaved || unsaved.length === 0) return
  retryingUnsaved = true
  try {
    while (unsaved.length) {
      await pool.query(OUTBOX_INSERT, [outboxService(), JSON.stringify(unsaved[0])])
      unsaved.shift()
    }
    relayAuditsSoon()
  } catch {
    setTimeout(() => retryUnsaved(), RETRY_MAX_MS).unref?.()
  } finally {
    retryingUnsaved = false
  }
}

/** The connection to reporting-service, opened on first use; Socket.IO reconnects by itself after a drop */
function auditSocket() {
  if (socket) return socket
  socket = io(config.services.reporting, {
    path: '/internal/audit-socket',
    auth: { secret: config.internalSecret, service: outboxService() },
    transports: ['websocket'],
    reconnectionDelay: 1_000,
    reconnectionDelayMax: RETRY_MAX_MS,
  })
  let warned = false
  socket.on('connect', () => {
    if (warned) logger.info('Audit connection to reporting-service is back; sending waiting entries')
    warned = false
    relayAuditsSoon()
  })
  socket.on('connect_error', (error) => {
    if (!warned) logger.warn('Audit connection to reporting-service failed; entries wait in the outbox', { error: error.message })
    warned = true
  })
  return socket
}

function relayAuditsSoon() {
  setImmediate(() => relayAudits().catch((error) => logger.warn('Audit relay failed', { error: error.message })))
}

/**
 * Pushes this service's waiting audit entries to reporting-service, oldest first, removing each once acknowledged.
 * Rows are locked while being sent (FOR UPDATE SKIP LOCKED), so several copies of a service never send one twice; if
 * a send is stored but its removal isn't, the entry's sourceKey makes reporting-service ignore the repeat.
 */
async function relayAudits() {
  const ws = auditSocket()
  // Not connected: the 'connect' handler runs this again as soon as the connection is up
  if (!ws.connected) return
  if (relaying) {
    relayAgain = true
    return
  }
  relaying = true
  let refused = false
  try {
    for (;;) {
      const client = await pool.connect()
      let sent = 0
      let rows = []
      try {
        await client.query('begin')
        ;({ rows } = await client.query(
          'select id, payload from audit_outbox where service = $1 order by id limit $2 for update skip locked',
          [outboxService(), OUTBOX_BATCH],
        ))
        for (const row of rows) {
          let reply
          try {
            reply = await ws.timeout(ACK_TIMEOUT_MS).emitWithAck('audit:record', { ...row.payload, sourceKey: `${outboxService()}:${row.id}` })
          } catch (error) {
            // No acknowledgement in time, or the connection dropped: stop here, reconnect resumes
            await client.query('update audit_outbox set attempts = attempts + 1, last_error = $2 where id = $1', [row.id, `No acknowledgement: ${error.message}`.slice(0, 500)])
            break
          }
          if (!reply?.ok) {
            refused = true
            await client.query('update audit_outbox set attempts = attempts + 1, last_error = $2 where id = $1', [row.id, String(reply?.error ?? 'refused').slice(0, 500)])
            // A malformed entry can't block the ones behind it; it stays in the outbox (with its error) for a look
            if (reply?.invalid) continue
            break
          }
          await client.query('delete from audit_outbox where id = $1', [row.id])
          sent++
        }
        await client.query('commit')
      } catch (error) {
        await client.query('rollback').catch(() => {})
        logger.warn('Audit relay paused', { error: error.message })
        break
      } finally {
        client.release()
      }
      if (!sent || rows.length < OUTBOX_BATCH || !ws.connected) break
    }
  } finally {
    relaying = false
  }
  if (refused && !refusedRetry) {
    // Connected, but reporting-service couldn't store an entry: try those again shortly
    refusedRetry = setTimeout(() => {
      refusedRetry = null
      relayAuditsSoon()
    }, REFUSED_RETRY_MS)
    refusedRetry.unref?.()
  }
  if (relayAgain) {
    relayAgain = false
    relayAuditsSoon()
  }
}

/**
 * Starts the relay (createService calls it). Connects only when there is something to send: entries left from before
 * a restart now, or the first new entry later.
 */
export function startAuditRelay(serviceName) {
  outboxName = serviceName
  pool
    .query('select 1 from audit_outbox where service = $1 limit 1', [outboxService()])
    .then(({ rowCount }) => rowCount && relayAuditsSoon())
    .catch((error) => logger.warn('Audit outbox not checked at start', { error: error.message }))
}

/** A JSON-safe copy of a record (dates as ISO strings, numeric strings kept), or null */
function snapshot(value) {
  if (value === null || value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

/**
 * Sends an email through notification-service. Unlike broadcast/audit this resolves or rejects, because some callers
 * tell the user when an email could not be sent.
 *   await sendMail('invitation', 'someone@example.com', { fullName, roleLabel, branchName, link, expiresIn })
 *   await sendMail('reset-password', email, { fullName, link, expiresInMinutes })
 */
export function sendMail(template, to, data) {
  return serviceClient('notification').post('/internal/email', { template, to, data }, { timeoutMs: 30_000 })
}
