import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { startAuditConsumer } from './services/auditConsumer.service.js'

/**
 * reporting-service: reports, the Owner dashboard and audit logs. Routes are mounted in routes/index.js; the audit log
 * is written from the Kafka topic audit.events, which every service streams its entries into
 * (services/auditConsumer.service.js).
 */
createService({ name: 'reporting-service', key: 'reporting', routes: registerRoutes, onStart: startAuditConsumer })
