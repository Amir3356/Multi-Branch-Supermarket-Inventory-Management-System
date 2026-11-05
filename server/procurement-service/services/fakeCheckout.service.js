import { notFound } from '../utils/index.js'
import { fakeChapaClient } from './fakeChapa.service.js'

/** The fake checkout started for this tx_ref, or a 404 once it has expired (or never existed) */
export function checkoutOrFail(txRef) {
  const checkout = fakeChapaClient.checkout(txRef)
  if (!checkout) throw notFound('This checkout has expired or does not exist.')
  return checkout
}

/** Records Pay or Decline; Cancel records nothing */
export function complete(txRef, outcome) {
  if (outcome !== 'cancel') fakeChapaClient.complete(txRef, outcome === 'pay' ? 'success' : 'failed')
}
