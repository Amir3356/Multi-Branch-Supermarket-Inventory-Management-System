import { Router } from '../utils/index.js'
import { bindFakeCheckout } from '../middleware/fakeCheckoutBinding.js'
import { validateFakeCheckoutOutcome } from '../middleware/validators/fakeCheckout.validator.js'
import * as controller from '../controllers/fakeCheckout.controller.js'

// The pretend Chapa checkout page used when CHAPA_MODE=fake (mounted only in that mode). Like Chapa's real page it is
// opened by the browser without the app's token, so it takes no sign-in.
const router = Router()

router.get('/procurements/fake-checkout/:txRef', bindFakeCheckout, controller.show)
router.post('/procurements/fake-checkout/:txRef', bindFakeCheckout, validateFakeCheckoutOutcome, controller.complete)

export default router
