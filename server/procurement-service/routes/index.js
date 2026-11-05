import { config } from '../utils/index.js'
import procurementsRouter from './procurement.routes.js'
import fakeCheckoutRouter from './fakeCheckout.routes.js'

/** Mounts every feature router of this service */
export function registerRoutes(app) {
  // Registered first, as in Laravel, so e.g. POST /procurements/fake-checkout/verify still means "verify"
  app.use(procurementsRouter)
  if (config.chapa.mode === 'fake') app.use(fakeCheckoutRouter)
}
