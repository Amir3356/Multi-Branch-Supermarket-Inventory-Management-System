/**
 * notification-service has no HTTP routes of its own: other services reach it over gRPC (SendEmail, Broadcast — see
 * controllers/internal.grpc.js) and through Kafka (realtime.events); browsers connect over Socket.IO at /socket.io.
 */
export function registerRoutes() {}
