import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { attachRealtime } from './services/realtime.service.js'
import { startRealtimeConsumer } from './services/realtimeConsumer.service.js'

/**
 * notification-service: emails and live updates. Live updates arrive through Kafka (topic realtime.events) and are
 * pushed to browsers over Socket.IO, which runs on this service's HTTP server (reached through the gateway at
 * /socket.io). POST /internal/broadcast stays as the fallback services use while Kafka is unreachable; emails come
 * in through POST /internal/email.
 */
const { server } = createService({ name: 'notification-service', key: 'notification', routes: registerRoutes, onStart: startRealtimeConsumer })
attachRealtime(server)
