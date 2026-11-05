import crypto from 'node:crypto'
import { abort, config } from '../utils/index.js'
import { rawurlencode } from '../utils/php.js'

/**
 * CHAPA_MODE=fake: stands in for Chapa during local development when no working Chapa key is available. "Checkout" is
 * a page on this service with Pay / Decline buttons; verify answers the way Chapa's API would. Refused in production,
 * where it would let anyone mark an order as paid.
 *
 * Laravel kept checkouts in its cache table; this service has no shared cache, so they live in memory for 7 days. A
 * restart forgets unfinished fake checkouts (their page then says the checkout expired). Development only, so that's fine.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const checkouts = new Map()

function ensureNotProduction() {
  if (config.env === 'production') {
    abort(503, 'CHAPA_MODE=fake is for local development only. Set CHAPA_MODE=test or live with real Chapa keys.')
  }
}

function put(txRef, checkout) {
  checkouts.set(txRef, { ...checkout, expiresAt: Date.now() + TTL_MS })
}

export const fakeChapaClient = {
  async initialize(payload) {
    ensureNotProduction()
    put(payload.tx_ref, { payload, status: 'pending' })
    return `${config.appUrl}/api/procurements/fake-checkout/${rawurlencode(payload.tx_ref)}`
  },

  async verify(txRef) {
    ensureNotProduction()
    const checkout = this.checkout(txRef)
    // Like Chapa: nothing to report until the person pays
    if (!checkout || checkout.status === 'pending') return null
    return {
      status: checkout.status,
      amount: checkout.payload.amount,
      currency: checkout.payload.currency,
      tx_ref: txRef,
      reference: `FAKE-${crypto.createHash('md5').update(txRef).digest('hex').slice(0, 10).toUpperCase()}`,
      method: 'test',
    }
  },

  /** The checkout started for this tx_ref: { payload, status: pending|success|failed }, or null */
  checkout(txRef) {
    const checkout = checkouts.get(txRef)
    if (!checkout) return null
    if (checkout.expiresAt <= Date.now()) {
      checkouts.delete(txRef)
      return null
    }
    return { payload: checkout.payload, status: checkout.status }
  },

  /** What the fake checkout page records when the person clicks Pay (success) or Decline (failed) */
  complete(txRef, status) {
    const checkout = this.checkout(txRef)
    if (checkout && checkout.status === 'pending') put(txRef, { ...checkout, status })
  },
}
