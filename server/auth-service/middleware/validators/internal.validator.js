import { z } from '../../utils/index.js'

/** Bodies of the service-to-service session endpoints (validateBody replaces req.body with the parsed value) */
const userId = z.coerce.number({ error: 'The userId field must be a number.' }).int().positive()
const reason = z.string({ error: 'The reason field is required.' }).min(1, { error: 'The reason field is required.' }).max(60)

/** IssueToken { userId } */
export const issueTokenSchema = z.object({ userId })

/** EndAllSessions / DeleteAllSessions { userId, reason } */
export const userSessionsSchema = z.object({ userId, reason })
