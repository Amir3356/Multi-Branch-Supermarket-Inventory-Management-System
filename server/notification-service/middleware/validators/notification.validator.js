import { templateNames } from '../../models/emailTemplate.model.js'
import { z } from '../../utils/index.js'

// Broadcast { channel, event, data } (gRPC)
export const broadcastSchema = z.object({
  channel: z.string().min(1),
  event: z.string().min(1),
  data: z.record(z.string(), z.any()).default({}),
})

// SendEmail { template, to, data } (gRPC)
export const emailSchema = z.object({
  template: z.enum(templateNames, { error: 'Unknown email template.' }),
  to: z.email({ error: 'The to field must be a valid email address.' }),
  data: z.record(z.string(), z.any()).default({}),
})
