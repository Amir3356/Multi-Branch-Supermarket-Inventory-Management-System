import { HttpError, broadcast, describeDevice, limit, logger, roleLabel, sectionsFor } from '../utils/index.js'
import { branchName, counts, createAuditLog, recentView, search } from '../repositories/auditLog.repository.js'
import { VIEWABLE_SECTIONS, inferActionType, sanitizeSnapshot } from '../models/auditLog.model.js'

// The same person opening the same page again within this many minutes isn't recorded again
const VIEW_REPEAT_MINUTES = 5
// Views being recorded right now, so two requests arriving together (e.g. a double render) make one entry
const viewsInFlight = new Set()

const ANNOUNCE_AFTER_MS = 250
let announceTimer = null

/**
 * AuditLogger::record for the internal API: fills in what the caller doesn't send (role label, branch name, device,
 * the action's type), strips secrets from the before / after snapshots, writes the entry (permanently: the table
 * refuses updates and deletes) and tells the Owner's Audit Logs page. Returns the new id.
 */
export async function record({ module, action, recordId = null, description, branchId = null, branchName: givenBranchName = null, actor = null, actorName = null, ip = null, userAgent = null, type = null, before = null, after = null, occurredAt = null, sourceKey = null }) {
  // When the action happened (sent by the caller, so an entry delivered late keeps its time), else now
  const at = occurredAt ? new Date(occurredAt).getTime() : Date.now()
  const { id, created } = await createAuditLog({
    // timestamp(0) would round fractions of a second; Laravel's now() was written truncated
    occurred_at: new Date(Math.floor(at / 1000) * 1000),
    user_id: actor?.id ?? null,
    user_name: actor?.fullName ?? actorName ?? null,
    // Payments Chapa confirms on its own (callback, scheduled check) are the system's, not a person's
    user_role: actor?.role ? roleLabel(actor.role) : actorName === 'Chapa' ? 'System' : null,
    branch_id: branchId,
    branch_name: givenBranchName ?? (await branchName(branchId)),
    module,
    action,
    record_id: recordId,
    description: limit(description, 2000),
    ip_address: ip,
    device: userAgent ? describeDevice(userAgent) : null,
    action_type: type ?? inferActionType(action),
    before_data: sanitizeSnapshot(before),
    after_data: sanitizeSnapshot(after),
    source_key: sourceKey,
  })
  if (created) announce()
  return id
}

/**
 * A signed-in user opened a page (the client reports it when the page mounts). Only pages their role can open are
 * recorded, and the same page again within a few minutes isn't. Returns whether an entry was written.
 */
export async function recordPageView(req, section) {
  const user = req.user
  const allowed = sectionsFor(user.role).includes(section)
  if (!allowed) throw new HttpError(403, 'Your role does not have access to this section.')

  const { module, page } = VIEWABLE_SECTIONS[section]
  const action = `Viewed ${page}`
  const key = `${user.id}|${action}`
  if (viewsInFlight.has(key)) return false
  viewsInFlight.add(key)
  try {
    if (await recentView(user.id, module, action, VIEW_REPEAT_MINUTES)) return false
    await record({
      module,
      action,
      type: 'view',
      description: `${user.fullName} opened the ${page} page${user.branchId && user.branchId !== 'all' ? '' : ' (all branches)'}.`,
      branchId: user.branchId && user.branchId !== 'all' ? user.branchId : null,
      actor: { id: user.id, fullName: user.fullName, role: user.role },
      ip: req.clientIp,
      userAgent: req.userAgent,
    })
    return true
  } finally {
    viewsInFlight.delete(key)
  }
}

/**
 * One live update for a burst of entries: the first entry starts a short timer and every entry recorded before it
 * fires shares the same push, so the page reloads at most once per 250 ms. Laravel sent one per request, after the
 * response; a broadcast problem never reaches the caller.
 */
function announce() {
  if (announceTimer) return
  announceTimer = setTimeout(() => {
    announceTimer = null
    try {
      broadcast('audit-logs', 'audit-log.recorded', {})
    } catch (error) {
      logger.warn('Live audit log update not sent', { error: error.message })
    }
  }, ANNOUNCE_AFTER_MS)
  announceTimer.unref?.()
}

/**
 * The Owner's Audit Logs page: read only, newest first, filtered and cursor-paged on the server. `filters.older` /
 * `filters.newer` is a cursor from a previous page (an entry's position); neither = the newest page.
 * Returns { rows, total, from, to, olderCursor, newerCursor, totals } for the controller to shape.
 */
export async function list(filters, perPage) {
  const cursor = filters.older ? { direction: 'older', ...decodeCursor(filters.older) } : filters.newer ? { direction: 'newer', ...decodeCursor(filters.newer) } : null
  const [page, totals] = await Promise.all([search(filters, cursor, perPage), counts()])
  const { rows, total, newerCount, hasOlder, hasNewer } = page
  return {
    rows,
    total,
    from: rows.length ? newerCount + 1 : null,
    to: rows.length ? newerCount + rows.length : null,
    olderCursor: hasOlder && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
    newerCursor: hasNewer && rows.length ? encodeCursor(rows[0]) : null,
    totals,
  }
}

/** An entry's position in the log as an opaque URL-safe token: its time and id */
const encodeCursor = (row) => Buffer.from(JSON.stringify([row.occurred_at.toISOString(), row.id])).toString('base64url')

function decodeCursor(token) {
  try {
    const [at, id] = JSON.parse(Buffer.from(String(token), 'base64url').toString('utf8'))
    const date = new Date(at)
    if (Number.isNaN(date.getTime()) || !Number.isSafeInteger(id)) throw new Error('bad cursor')
    return { at: date, id }
  } catch {
    throw new HttpError(422, 'This page link is no longer valid. Go back to the newest entries.')
  }
}
