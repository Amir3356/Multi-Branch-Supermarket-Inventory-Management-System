import { logger } from './logger.js'
import { serviceClient } from './serviceClient.js'

/**
 * Side effects owned by other services, sent fire-and-forget: a stopped notification or reporting service never slows
 * or breaks the action that triggered them (as Laravel sent broadcasts and audit entries after the response).
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
 * Records an action in the audit log (reporting-service): who (the signed-in user, unless `actor` is given), from which
 * IP and device, on which branch, and what happened. Call it right after the action succeeds. Never throws.
 *
 *   audit(req, { module: 'Sales', action: 'Recorded sale', recordId: sale.id, description: '…', branchId })
 *
 * actor:      { id, fullName, role } when it isn't the signed-in user (e.g. a sign-in before there is a session)
 * actorName:  a name with no account behind it (the email typed at a failed sign-in, or 'Chapa' for the system)
 * branchName: only for a branch that no longer exists (just deleted), whose name can't be looked up
 */
export function audit(req, { module, action, recordId = null, description, branchId = null, actor = null, actorName = null, branchName = null }) {
  const who = actor ?? req?.user ?? null
  serviceClient('reporting')
    .post(
      '/internal/audit-logs',
      {
        module,
        action,
        recordId: recordId === null || recordId === undefined ? null : String(recordId),
        description,
        branchId,
        branchName,
        actor: who ? { id: who.id, fullName: who.fullName, role: who.role } : null,
        actorName,
        ip: req?.clientIp ?? null,
        userAgent: req?.userAgent ?? null,
      },
      { timeoutMs: 5_000 },
    )
    .catch((error) => logger.error('Audit log not written', { module, action, recordId, error: error.message }))
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
