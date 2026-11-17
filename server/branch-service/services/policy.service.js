import { audit, broadcast } from '../utils/index.js'
import * as policies from '../repositories/policy.repository.js'
import { presentPolicy } from '../models/policy.model.js'
import * as cache from '../utils/cache.js'

/**
 * The store's policy (Laravel's PolicyController logic and PolicyBroadcaster). The live payload is what the old
 * event's broadcastWith() sent (PolicyChanged: the policy resource).
 */

const POLICY_KEY = 'policy:current'

/** Every open screen re-flags its stock at once; the cached copy is cleared first */
export async function policyChanged(policy) {
  await cache.forget(POLICY_KEY)
  broadcast('policy', 'policy.changed', { policy: presentPolicy(policy) })
}

/** The store's policy, cached (it changes only when the Inventory Officer saves Settings) */
export const current = () => cache.remember(POLICY_KEY, 600, () => policies.current())

/** Saves the validated values ({ defaultMinStock, expiryWarningDays } as integers); returns the saved policy */
export async function update(req, { defaultMinStock, expiryWarningDays }) {
  const before = await policies.current()
  const policy = await policies.update({ defaultMinStock, expiryWarningDays }, req.user.id)
  policyChanged(policy)

  const changes = [
    before.default_min_stock !== policy.default_min_stock ? `minimum stock ${before.default_min_stock} → ${policy.default_min_stock} units` : null,
    before.expiry_warning_days !== policy.expiry_warning_days
      ? `expiring-soon window ${before.expiry_warning_days} → ${policy.expiry_warning_days} days`
      : null,
  ].filter(Boolean)
  const summary = changes.length ? changes.join(', ') : 'Saved with no changes'
  audit(req, {
    module: 'Policy',
    action: 'Policy updated',
    recordId: null,
    description: `${summary.charAt(0).toUpperCase()}${summary.slice(1)} (every product at all branches).`,
    branchId: req.user.branchId,
    before,
    after: policy,
  })
  return policy
}
