import { ACTION_TYPES, MODULES, PER_PAGE, toCountsResource, toResource } from '../models/auditLog.model.js'
import * as auditLogService from '../services/auditLog.service.js'

/** GET /audit-logs: the Owner's Audit Logs page, filtered (req.validatedQuery) and cursor-paged (?older= / ?newer=) */
export async function index(req, res) {
  const { rows, total, from, to, olderCursor, newerCursor, totals } = await auditLogService.list(req.validatedQuery, PER_PAGE)
  res.json({
    data: rows.map(toResource),
    // Cursor pagination: pass older_cursor back as ?older=… for the next (older) page, newer_cursor as ?newer=…
    meta: { per_page: PER_PAGE, total, from, to, older_cursor: olderCursor, newer_cursor: newerCursor },
    modules: MODULES,
    actionTypes: ACTION_TYPES,
    counts: toCountsResource(totals),
  })
}

/** POST /audit-logs/views { section }: the signed-in user opened that page → { recorded } */
export async function view(req, res) {
  res.status(201).json({ recorded: await auditLogService.recordPageView(req, req.body.section) })
}
