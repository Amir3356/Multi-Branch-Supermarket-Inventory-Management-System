import { grpcClient, logger } from '../utils/index.js'

// Sessions (personal_access_tokens) belong to auth-service: ending or deleting them goes through its internal gRPC API
const auth = grpcClient('auth')

/**
 * Ends every open session of the user (deactivated account). The account change has already been saved, so a stopped
 * auth-service is logged rather than failing the request.
 */
export async function endAllFor(userId, reason) {
  try {
    const { count } = await auth.call('EndAllSessions', { userId, reason })
    return { ended: count }
  } catch (error) {
    logger.error('Sessions not ended', { userId, reason, error: error.message })
    return { ended: 0 }
  }
}

/**
 * Deletes every session of the user (account deleted). Called before the user row is deleted, and its errors
 * propagate, so an account is never removed while its sessions could live on.
 */
export const deleteAllFor = async (userId, reason) => ({ deleted: (await auth.call('DeleteAllSessions', { userId, reason })).count })
