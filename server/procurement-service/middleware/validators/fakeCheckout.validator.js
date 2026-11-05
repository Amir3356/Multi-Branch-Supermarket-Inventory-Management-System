import { normalizeInput } from '../../utils/php.js'
import { validateRules } from '../../utils/validation.js'

/** Pay, Decline or Cancel on the fake checkout page. Leaves the validated input on req.validated. */
export async function validateFakeCheckoutOutcome(req, res, next) {
  req.validated = await validateRules(normalizeInput(req.body ?? {}), { outcome: ['required', { name: 'in', values: ['pay', 'decline', 'cancel'] }] })
  next()
}
