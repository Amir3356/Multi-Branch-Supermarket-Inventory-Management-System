import { fakeCheckoutPage } from '../utils/templates/fakeCheckout.js'
import * as fakeCheckoutService from '../services/fakeCheckout.service.js'

export function show(req, res) {
  res.type('html').send(fakeCheckoutPage({ txRef: req.params.txRef, ...req.checkout }))
}

// Pay or Decline, then back to the app exactly like Chapa's return_url; Cancel just goes back
export function complete(req, res) {
  fakeCheckoutService.complete(req.params.txRef, req.validated.outcome)
  res.redirect(302, req.checkout.payload.return_url)
}
