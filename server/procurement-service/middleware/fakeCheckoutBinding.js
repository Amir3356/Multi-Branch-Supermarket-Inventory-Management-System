import { checkoutOrFail } from '../services/fakeCheckout.service.js'

/** The fake checkout for :txRef as req.checkout, or a 404 once it has expired */
export function bindFakeCheckout(req, res, next) {
  req.checkout = checkoutOrFail(req.params.txRef)
  next()
}
