import { logger, z } from '../utils/index.js'
import { TOPICS, consume, setKafkaClientId } from '../utils/kafka.js'
import { broadcast } from './realtime.service.js'

const EVENT = z.object({ channel: z.string().min(1), event: z.string().min(1), data: z.record(z.string(), z.any()).default({}) })

/**
 * Consumes realtime.events (consumer group "notification-realtime"): every service streams its live updates there,
 * and each one is pushed to the browsers on its Socket.IO channel. Starts at the newest events (a screen doesn't need
 * updates from before this service started).
 */
export function startRealtimeConsumer() {
  setKafkaClientId('notification-service')
  consume({
    groupId: 'notification-realtime',
    topic: TOPICS.REALTIME,
    fromBeginning: false,
    handle: async (message) => {
      let parsed
      try {
        parsed = EVENT.safeParse(JSON.parse(message.value.toString('utf8')))
      } catch {
        parsed = { success: false }
      }
      if (!parsed.success) return logger.warn('Live update skipped: not a valid event')
      broadcast(parsed.data.channel, parsed.data.event, parsed.data.data)
    },
  })
}
