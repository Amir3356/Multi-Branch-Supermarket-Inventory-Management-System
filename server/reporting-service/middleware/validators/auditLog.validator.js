import { z } from '../../utils/index.js'
import { cleanInput } from '../../utils/dataUtils.js'
import { NULLABLE, afterOrEqual, dateFormat, inList, max, string, validateInput } from '../../utils/validation.js'
import { ACTION_TYPES, MODULES, VIEWABLE_SECTIONS } from '../../models/auditLog.model.js'
import { validateBody } from '../index.js'
import { END_DATE_MESSAGE } from './report.validator.js'

const LIST_RULES = {
  from: [NULLABLE, dateFormat('from')],
  to: [NULLABLE, dateFormat('to'), afterOrEqual('from', END_DATE_MESSAGE)],
  module: [NULLABLE, inList('module', MODULES)],
  type: [NULLABLE, inList('type', ACTION_TYPES)],
  branchId: [NULLABLE, string('branchId'), max('branchId', 20)],
  search: [NULLABLE, string('search'), max('search', 100)],
  // Cursors from a previous page's meta.older_cursor / meta.newer_cursor
  older: [NULLABLE, string('older'), max('older', 200)],
  newer: [NULLABLE, string('newer'), max('newer', 200)],
}

/** The Audit Logs page's filters (Laravel's 422 on failure); the validated fields go to req.validatedQuery */
export async function validateAuditLogFilters(req, res, next) {
  req.validatedQuery = await validateInput(cleanInput(req.query), LIST_RULES)
  next()
}

const optionalText = z.preprocess((value) => (typeof value === 'number' ? String(value) : value), z.string().nullish().default(null))

/** An entry another service pushes over the audit WebSocket ('audit:record'; see services/auditSocket.service.js) */
export const AUDIT_ENTRY = z.object({
  module: z.string({ error: 'The module field is required.' }).min(1, { error: 'The module field is required.' }),
  action: z.string({ error: 'The action field is required.' }).min(1, { error: 'The action field is required.' }),
  recordId: optionalText,
  description: z.preprocess((value) => (value === null || value === undefined ? value : String(value)), z.string({ error: 'The description field is required.' })),
  branchId: optionalText,
  branchName: optionalText,
  actor: z
    .object({ id: z.number().nullish(), fullName: z.string().nullish(), role: z.string().nullish() })
    .nullish()
    .default(null),
  actorName: optionalText,
  type: z.enum(ACTION_TYPES, { error: 'The type field is invalid.' }).nullish().default(null),
  // Snapshots of the record before and after the action (any JSON); reporting-service strips secrets
  before: z.unknown().nullish().default(null),
  after: z.unknown().nullish().default(null),
  ip: optionalText,
  userAgent: optionalText,
  // When the action happened (the caller's clock); a delivery delayed by the outbox keeps its real time
  occurredAt: z.iso.datetime({ offset: true, error: 'The occurredAt field must be an ISO date-time.' }).nullish().default(null),
  // "<service>:<outbox id>": a retried delivery of the same entry is stored once
  sourceKey: z.string().max(80).nullish().default(null),
})

/** POST /audit-logs/views: { section } a signed-in user just opened (a client page key) */
export const validatePageView = validateBody(
  z.object({ section: z.enum(Object.keys(VIEWABLE_SECTIONS), { error: 'Unknown page.' }) }),
)
