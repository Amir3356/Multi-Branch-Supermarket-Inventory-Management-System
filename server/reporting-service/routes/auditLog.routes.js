import { Router } from '../utils/index.js'
import { requireRole } from '../middleware/index.js'
import { validateAuditLogFilters } from '../middleware/validators/auditLog.validator.js'
import * as auditLogController from '../controllers/auditLog.controller.js'

// The Owner's Audit Logs page: read only, newest first, filtered and paged on the server
export const auditLogRouter = Router()

auditLogRouter.get('/audit-logs', requireRole('owner'), validateAuditLogFilters, auditLogController.index)
