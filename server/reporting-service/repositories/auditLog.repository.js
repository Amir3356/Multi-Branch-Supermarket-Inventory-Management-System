import { DateTime, config, one, query } from '../utils/index.js'
import { Params, dbTime, truthy } from '../utils/dataUtils.js'

/**
 * Writes one entry (reporting-service is the only writer of audit_logs); returns its id. An entry whose source_key was
 * already stored (a retried delivery) isn't written again: { id, created: false } with the stored entry's id.
 */
export async function createAuditLog(entry) {
  const row = await one(
    `insert into audit_logs (occurred_at, user_id, user_name, user_role, branch_id, branch_name, module, action, record_id, description, ip_address, device, action_type, before_data, after_data, source_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16)
     on conflict (source_key) do nothing returning id`,
    [
      entry.occurred_at, entry.user_id, entry.user_name, entry.user_role, entry.branch_id, entry.branch_name,
      entry.module, entry.action, entry.record_id, entry.description, entry.ip_address, entry.device,
      entry.action_type, entry.before_data === null ? null : JSON.stringify(entry.before_data), entry.after_data === null ? null : JSON.stringify(entry.after_data),
      entry.source_key ?? null,
    ],
  )
  if (row) return { id: row.id, created: true }
  const existing = await one('select id from audit_logs where source_key = $1', [entry.source_key])
  return { id: existing.id, created: false }
}

/** Whether this user already has the same view recorded within the last `minutes` (repeat visits aren't re-logged) */
export async function recentView(userId, module, action, minutes) {
  const row = await one(
    `select 1 from audit_logs
     where user_id = $1 and action_type = 'view' and module = $2 and action = $3 and occurred_at >= $4
     limit 1`,
    // Written the same way as occurred_at, so the comparison is in the same time base
    [userId, module, action, new Date(Date.now() - minutes * 60_000)],
  )
  return Boolean(row)
}

/** A branch's name for the log (its id if it no longer exists) */
export async function branchName(branchId) {
  if (!truthy(branchId)) return null
  return (await one('select name from branches where id = $1', [branchId]))?.name ?? branchId
}

/** The Audit Logs cards, across every branch and module: all actions ever recorded, and today's (store's local day) */
export async function counts() {
  const todayStart = dbTime(DateTime.now().setZone(config.timezone).startOf('day').toUTC())
  const row = await one(
    `select count(*) as total, min(occurred_at) as since,
      count(*) filter (where occurred_at >= $1) as today,
      count(distinct user_id) filter (where occurred_at >= $1 and user_id is not null) as today_users
     from audit_logs`,
    [todayStart],
  )
  return { total: Number(row.total), since: row.since, today: Number(row.today), todayUsers: Number(row.today_users) }
}

/**
 * One page of the log, newest first, filtered: `from`/`to` are calendar days in the store's time zone, `search` matches
 * the user, action, record or details. Cursor (keyset) paged on (occurred_at, id), so entries recorded while someone
 * reads never shift or repeat rows:
 *   cursor null                      the newest page
 *   { direction: 'older', at, id }   the page after that entry (older)
 *   { direction: 'newer', at, id }   the page before that entry (newer)
 * Returns { rows, total, newerCount, hasOlder, hasNewer }: newerCount is how many matching entries come before the page.
 */
export async function search(filters, cursor, perPage) {
  const zone = config.timezone
  const p = new Params()
  const conditions = []
  if (truthy(filters.from)) conditions.push(`occurred_at >= ${p.add(dbTime(DateTime.fromISO(filters.from, { zone }).startOf('day').toUTC()))}`)
  if (truthy(filters.to)) conditions.push(`occurred_at <= ${p.add(dbTime(DateTime.fromISO(filters.to, { zone }).endOf('day').toUTC()))}`)
  if (truthy(filters.module)) conditions.push(`module = ${p.add(filters.module)}`)
  if (truthy(filters.type)) conditions.push(`action_type = ${p.add(filters.type)}`)
  if (truthy(filters.branchId)) conditions.push(`branch_id = ${p.add(filters.branchId)}`)
  if (truthy(filters.search)) {
    // LIKE wildcards typed by the user are matched literally
    const like = `%${filters.search.toLowerCase().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
    const term = p.add(like)
    conditions.push(`(lower(user_name) like ${term} or lower(action) like ${term} or lower(record_id) like ${term} or lower(description) like ${term})`)
  }
  const filtered = conditions.length ? conditions.join(' and ') : 'true'
  const total = Number((await one(`select count(*) as aggregate from audit_logs where ${filtered}`, p.values)).aggregate)
  if (!total) return { rows: [], total, newerCount: 0, hasOlder: false, hasNewer: false }

  let rows
  let hasOlder
  let hasNewer
  if (cursor?.direction === 'newer') {
    // Walk up from the cursor (oldest of the newer ones first), then show them newest first
    const cp = new Params(); cp.values.push(...p.values)
    const at = cp.add(cursor.at)
    const id = cp.add(cursor.id)
    const found = await query(
      `select * from audit_logs where ${filtered} and (occurred_at, id) > (${at}, ${id}) order by occurred_at asc, id asc limit ${perPage + 1}`,
      cp.values,
    )
    hasNewer = found.length > perPage
    rows = found.slice(0, perPage).reverse()
    hasOlder = true
  } else {
    const cp = new Params(); cp.values.push(...p.values)
    const after = cursor?.direction === 'older' ? ` and (occurred_at, id) < (${cp.add(cursor.at)}, ${cp.add(cursor.id)})` : ''
    const found = await query(
      `select * from audit_logs where ${filtered}${after} order by occurred_at desc, id desc limit ${perPage + 1}`,
      cp.values,
    )
    hasOlder = found.length > perPage
    rows = found.slice(0, perPage)
    hasNewer = cursor?.direction === 'older'
  }

  // Where the page sits in the whole filtered list ("26–50 of 120"): the matching entries newer than its first row
  let newerCount = 0
  if (rows.length && hasNewer) {
    const np = new Params(); np.values.push(...p.values)
    const first = rows[0]
    newerCount = Number((await one(
      `select count(*) as aggregate from audit_logs where ${filtered} and (occurred_at, id) > (${np.add(first.occurred_at)}, ${np.add(first.id)})`,
      np.values,
    )).aggregate)
    hasNewer = newerCount > 0
  }
  return { rows, total, newerCount, hasOlder, hasNewer }
}
