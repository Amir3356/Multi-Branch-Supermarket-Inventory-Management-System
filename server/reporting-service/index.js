import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { attachAuditSocket } from './services/auditSocket.service.js'

/**
 * reporting-service: reports, the Owner dashboard and audit logs. Routes are mounted in routes/index.js; other
 * services push their audit entries over the WebSocket attached here (services/auditSocket.service.js).
 */
createService({ name: 'reporting-service', key: 'reporting', routes: registerRoutes, attach: attachAuditSocket })
