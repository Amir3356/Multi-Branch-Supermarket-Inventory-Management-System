import { HttpError, logger, validate } from '../utils/index.js'
import { broadcastSchema, emailSchema } from '../middleware/validators/notification.validator.js'
import { sendTemplate } from '../services/mail.service.js'
import { broadcast } from '../services/realtime.service.js'

/** notification-service's internal gRPC API (service Notification in proto/supermarket.proto) */
const parse = (json) => {
  try {
    return json ? JSON.parse(json) : {}
  } catch {
    throw new HttpError(422, 'The data field must be JSON.')
  }
}

export const notificationGrpc = {
  Notification: {
    /** A templated email; UNAVAILABLE (502) when the mail server refuses */
    async SendEmail(request) {
      const { template, to, data } = validate(emailSchema, { template: request.template, to: request.to, data: parse(request.dataJson) })
      try {
        await sendTemplate(template, to, data)
      } catch (error) {
        logger.error('Email not sent', { template, to, error: error.message })
        throw new HttpError(502, 'The email could not be sent. Check the mail settings and try again.')
      }
      return { sent: true }
    },

    /** A live update to the browsers on a channel (the services' fallback while Kafka is unreachable) */
    async Broadcast(request) {
      const { channel, event, data } = validate(broadcastSchema, { channel: request.channel, event: request.event, data: parse(request.dataJson) })
      return { sent: true, listeners: broadcast(channel, event, data) }
    },
  },
}
