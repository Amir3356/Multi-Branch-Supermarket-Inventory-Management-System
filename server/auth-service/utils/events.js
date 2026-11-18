import { pool } from './db.js'
import { TOPICS, publish, setKafkaClientId } from './kafka.js'
import { logger } from './logger.js'
import { gauge } from './metrics.js'
import { traceHeaders } from './tracing.js'
import { grpcClient } from './grpc.js'

/**
 * Side effects owned by other services, sent fire-and-forget through Kafka: a stopped notification or reporting service
 * never slows or breaks the action that triggered them. Audit entries also survive a stopped Kafka (see audit()).
 * Inside a transaction, call them from client.afterCommit(() => ...) so a rolled-back change is never announced.
 */

/**
 * Pushes a live update to every browser subscribed to a channel: streamed through Kafka's realtime.events topic to
 * notification-service, which emits it over Socket.IO. While Kafka is unreachable it is sent to notification-service
 * directly (gRPC Broadcast) instead, so screens still update.
 *   broadcast('branch.BR-01.sales', 'sale.recorded', { sale })
 * The client listens with realtime().private('branch.BR-01.sales').listen('.sale.recorded', handler).
 */
export function broadcast(channel, event, data = {}) {
  publish(TOPICS.REALTIME, [{ key: channel, value: JSON.stringify({ channel, event, data }) }]).catch(() =>
    grpcClient('notification')
      .call('Broadcast', { channel, event, dataJson: JSON.stringify(data ?? {}) }, { timeoutMs: 5_000 })
      .catch((error) => logger.warn('Live update not sent', { channel, event, error: error.message })),
  )
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
 * streamed to Kafka (topic audit.events), which reporting-service consumes; it leaves the outbox once Kafka has stored it. A stopped or slow reporting-service only delays
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
    // The request's trace, so the audit log write later joins the same trace (sent as Kafka headers, not stored)
    traceContext: traceHeaders(),
  }
  saveToOutbox(entry)
}

// ---- Audit outbox relay (Kafka) ------------------------------------------------------------------------------------
//
// Entries are streamed to Kafka's audit.events topic (key = this service, so its entries stay in order on one
// partition); reporting-service consumes the topic and writes the audit log. An entry leaves the outbox only once
// Kafka has stored it. Nothing polls: entries are sent the moment they're saved; after a failed send (Kafka down)
// the relay tries again with a growing pause, and at start-up it sends whatever was left from before.

const OUTBOX_BATCH = 100
const RETRY_MIN_MS = 2_000
const RETRY_MAX_MS = 30_000
// Entries that couldn't even be saved to the outbox (database unreachable for a moment): kept here and retried
const unsaved = []
let relaying = false
let relayAgain = false
let retryTimer = null
let retryDelay = RETRY_MIN_MS
let warned = false

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

function relayAuditsSoon() {
  setImmediate(() => relayAudits().catch((error) => logger.warn('Audit relay failed', { error: error.message })))
}

function retryLater() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    relayAuditsSoon()
  }, retryDelay)
  retryTimer.unref?.()
  retryDelay = Math.min(RETRY_MAX_MS, retryDelay * 2)
}

/**
 * Publishes this service's waiting audit entries to Kafka, oldest first, in batches, removing them once Kafka has
 * stored them. Rows are locked while being sent (FOR UPDATE SKIP LOCKED), so several copies of a service never send one
 * twice; if a send is stored but the removal isn't, the entry's sourceKey makes reporting-service ignore the repeat.
 */
async function relayAudits() {
  if (relaying) {
    relayAgain = true
    return
  }
  relaying = true
  let failed = false
  try {
    for (;;) {
      const client = await pool.connect()
      let rows = []
      try {
        await client.query('begin')
        ;({ rows } = await client.query(
          'select id, payload from audit_outbox where service = $1 order by id limit $2 for update skip locked',
          [outboxService(), OUTBOX_BATCH],
        ))
        if (rows.length) {
          try {
            await publish(
              TOPICS.AUDIT,
              rows.map((row) => {
                const { traceContext, ...entry } = row.payload
                return {
                  key: outboxService(),
                  value: JSON.stringify({ ...entry, sourceKey: `${outboxService()}:${row.id}` }),
                  headers: { ...(traceContext ?? {}), source: outboxService() },
                }
              }),
            )
          } catch (error) {
            failed = true
            await client.query('update audit_outbox set attempts = attempts + 1, last_error = $2 where id = any($1::bigint[])', [
              rows.map((row) => row.id),
              String(error.message).slice(0, 500),
            ])
            if (!warned) logger.warn('Kafka unavailable; audit entries wait in the outbox', { error: error.message })
            warned = true
          }
          if (!failed) await client.query('delete from audit_outbox where id = any($1::bigint[])', [rows.map((row) => row.id)])
        }
        await client.query('commit')
      } catch (error) {
        await client.query('rollback').catch(() => {})
        failed = true
        logger.warn('Audit relay paused', { error: error.message })
      } finally {
        client.release()
      }
      if (failed || rows.length < OUTBOX_BATCH) break
    }
  } finally {
    relaying = false
  }
  if (failed) return retryLater()
  if (warned) logger.info('Kafka is back; waiting audit entries were sent')
  warned = false
  retryDelay = RETRY_MIN_MS
  if (relayAgain) {
    relayAgain = false
    relayAuditsSoon()
  }
}

// Monitoring: how many of this service's audit entries are waiting to be streamed (should stay near 0)
gauge('audit_outbox_pending', 'Audit entries waiting in this service\'s outbox to be streamed to Kafka', async () =>
  Number((await pool.query('select count(*)::int as n from audit_outbox where service = $1', [outboxService()])).rows[0].n),
)

/** Starts the relay (createService calls it): sends anything left in the outbox from before a restart */
export function startAuditRelay(serviceName) {
  outboxName = serviceName
  setKafkaClientId(serviceName)
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
 * Sends an email through notification-service (gRPC SendEmail). Unlike broadcast/audit this resolves or rejects, because some callers
 * tell the user when an email could not be sent.
 *   await sendMail('invitation', 'someone@example.com', { fullName, roleLabel, branchName, link, expiresIn })
 *   await sendMail('reset-password', email, { fullName, link, expiresInMinutes })
 */
export function sendMail(template, to, data) {
  return grpcClient('notification').call('SendEmail', { template, to, dataJson: JSON.stringify(data ?? {}) }, { timeoutMs: 30_000 })
}
