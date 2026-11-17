import { logger } from '../utils/index.js'
import { TOPICS, consume, publish } from '../utils/kafka.js'
import { AUDIT_ENTRY } from '../middleware/validators/auditLog.validator.js'
import { record } from './auditLog.service.js'

/**
 * The audit log's writer: consumes the audit.events topic (consumer group "reporting-audit"), into which every service
 * streams its audit entries from its outbox. Each entry is validated and stored; a repeat of one already stored (same
 * sourceKey, e.g. a re-delivery) is ignored. An entry that can't be valid is moved to audit.events.dlq instead of
 * blocking the stream; when the database is unavailable the handler throws, so Kafka delivers it again later and no
 * entry is lost.
 */
export function startAuditConsumer() {
  consume({
    groupId: 'reporting-audit',
    topic: TOPICS.AUDIT,
    fromBeginning: true,
    handle: async (message) => {
      let entry
      try {
        entry = JSON.parse(message.value.toString('utf8'))
      } catch {
        return deadLetter(message, 'Not valid JSON')
      }
      const parsed = AUDIT_ENTRY.safeParse(entry)
      if (!parsed.success) return deadLetter(message, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      await record(parsed.data)
    },
  })
}

async function deadLetter(message, reason) {
  logger.error('Audit entry moved to the dead-letter topic', { reason })
  await publish(TOPICS.AUDIT_DLQ, [
    { key: message.key, value: message.value, headers: { ...(message.headers ?? {}), error: reason.slice(0, 500) } },
  ])
}
