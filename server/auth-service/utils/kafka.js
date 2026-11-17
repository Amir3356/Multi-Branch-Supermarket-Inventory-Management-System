import { Kafka, Partitioners, logLevel } from 'kafkajs'
import { config } from './config.js'
import { logger } from './logger.js'
import { kafkaMessages } from './metrics.js'
import { SpanKind, contextFrom, inTrace, traceHeaders, traced } from './tracing.js'

/**
 * Event streaming (Apache Kafka). Services publish events to topics; the services interested in them consume them in
 * their own consumer group, at their own pace, and Kafka keeps the events for the topic's retention period.
 *
 *   audit.events      every service's audit entries (from its transactional outbox) → reporting-service
 *   audit.events.dlq  audit entries reporting-service could not accept, kept for inspection (dead-letter queue)
 *   realtime.events   live-update events → notification-service, which pushes them to browsers (Socket.IO)
 */
export const TOPICS = Object.freeze({
  AUDIT: 'audit.events',
  AUDIT_DLQ: 'audit.events.dlq',
  REALTIME: 'realtime.events',
})

const DAY_MS = 86_400_000
const TOPIC_SETTINGS = [
  { topic: TOPICS.AUDIT, numPartitions: 3, configEntries: [{ name: 'retention.ms', value: String(7 * DAY_MS) }] },
  { topic: TOPICS.AUDIT_DLQ, numPartitions: 1, configEntries: [{ name: 'retention.ms', value: String(30 * DAY_MS) }] },
  // Live updates matter only for a moment: kept an hour
  { topic: TOPICS.REALTIME, numPartitions: 3, configEntries: [{ name: 'retention.ms', value: String(3_600_000) }] },
]

let kafka = null
let clientId = 'supermart'
let producerPromise = null
let topicsReady = null

/** Names this service's Kafka client (createService calls it with the service name) */
export function setKafkaClientId(name) {
  clientId = name
}

function client() {
  if (!kafka) {
    kafka = new Kafka({
      clientId,
      brokers: config.kafkaBrokers.split(',').map((b) => b.trim()).filter(Boolean),
      logLevel: logLevel.NOTHING,
      connectionTimeout: 3_000,
      retry: { initialRetryTime: 300, retries: 3 },
    })
  }
  return kafka
}

/** Creates the topics once (a topic that already exists is left as it is) */
export function ensureTopics() {
  if (!topicsReady) {
    topicsReady = (async () => {
      const admin = client().admin()
      await admin.connect()
      try {
        await admin.createTopics({ topics: TOPIC_SETTINGS.map((t) => ({ ...t, replicationFactor: 1 })), waitForLeaders: true })
      } finally {
        await admin.disconnect().catch(() => {})
      }
    })().catch((error) => {
      topicsReady = null
      throw error
    })
  }
  return topicsReady
}

/** The connected producer: idempotent, so a retried send is written once */
function producer() {
  if (!config.kafkaBrokers) return Promise.reject(new Error('Kafka is not configured (KAFKA_BROKERS is empty).'))
  if (!producerPromise) {
    producerPromise = (async () => {
      await ensureTopics()
      const p = client().producer({ idempotent: true, maxInFlightRequests: 1, createPartitioner: Partitioners.DefaultPartitioner })
      p.on(p.events.DISCONNECT, () => {
        producerPromise = null
      })
      await p.connect()
      return p
    })().catch((error) => {
      producerPromise = null
      throw error
    })
  }
  return producerPromise
}

/**
 * Publishes messages ({ key, value, headers? }) to a topic and resolves once every in-sync replica stored them
 * (acks: all). Rejects when Kafka is unreachable; callers decide whether to retry.
 */
export async function publish(topic, messages) {
  if (inTrace()) {
    // A PRODUCER span; each message carries the trace (traceparent header) so its consumer joins the same trace
    return traced(`publish ${topic}`, { kind: SpanKind.PRODUCER, attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': topic, 'messaging.batch.message_count': messages.length } }, () =>
      send(topic, messages.map((m) => ({ ...m, headers: { ...traceHeaders(), ...(m.headers ?? {}) } }))),
    )
  }
  return send(topic, messages)
}

async function send(topic, messages) {
  try {
    const p = await producer()
    await p.send({ topic, acks: -1, messages })
    kafkaMessages.inc({ topic, direction: 'produced', result: 'ok' }, messages.length)
  } catch (error) {
    kafkaMessages.inc({ topic, direction: 'produced', result: 'failed' }, messages.length)
    throw error
  }
}

/**
 * Consumes a topic as `groupId` for as long as the service runs: each message goes to handle(message). A message whose
 * handler throws is retried (the partition waits), so nothing is skipped; reconnects by itself after Kafka restarts.
 */
export function consume({ groupId, topic, fromBeginning = true, handle }) {
  if (!config.kafkaBrokers) {
    logger.warn(`Kafka is not configured; not consuming ${topic}`)
    return
  }
  const start = async () => {
    try {
      await ensureTopics()
      const consumer = client().consumer({ groupId, retry: { initialRetryTime: 500, retries: 8 } })
      consumer.on(consumer.events.CRASH, ({ payload }) => {
        if (!payload.restart) {
          logger.warn(`Kafka consumer ${groupId} stopped; restarting`, { error: payload.error?.message })
          setTimeout(start, 5_000).unref?.()
        }
      })
      await consumer.connect()
      await consumer.subscribe({ topic, fromBeginning })
      await consumer.run({
        eachMessage: async ({ message, partition }) => {
          try {
            // A CONSUMER span continuing the trace the producer put in the message headers
            await traced(`process ${topic}`, {
              kind: SpanKind.CONSUMER,
              parent: contextFrom(message.headers),
              attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': topic, 'messaging.consumer.group.name': groupId, 'messaging.kafka.destination.partition': partition, 'messaging.kafka.message.offset': message.offset },
            }, () => handle(message))
            kafkaMessages.inc({ topic, direction: 'consumed', result: 'ok' })
          } catch (error) {
            kafkaMessages.inc({ topic, direction: 'consumed', result: 'failed' })
            throw error
          }
        },
      })
      logger.info(`Consuming ${topic} as ${groupId}`)
    } catch (error) {
      logger.warn(`Kafka consumer ${groupId} not started yet; retrying`, { error: error.message })
      setTimeout(start, 5_000).unref?.()
    }
  }
  start()
}
