<?php

namespace App\Features\Procurements\Services;

use Illuminate\Support\Facades\Cache;

/**
 * CHAPA_MODE=fake: stands in for Chapa during local development when no working Chapa key is available.
 * "Checkout" is a page on this server with Pay / Decline buttons; verify answers the way Chapa's API would.
 * Refused in production, where it would let anyone mark an order as paid.
 */
class FakeChapaClient extends ChapaClient
{
    private const TTL_DAYS = 7;

    public function initialize(array $payload): string
    {
        $this->ensureNotProduction();
        Cache::put($this->key($payload['tx_ref']), ['payload' => $payload, 'status' => 'pending'], now()->addDays(self::TTL_DAYS));

        return url('/api/procurements/fake-checkout/'.rawurlencode($payload['tx_ref']));
    }

    public function verify(string $txRef): ?array
    {
        $this->ensureNotProduction();
        $checkout = $this->checkout($txRef);
        if (! $checkout || $checkout['status'] === 'pending') {
            return null; // like Chapa: nothing to report until the person pays
        }

        return [
            'status' => $checkout['status'],
            'amount' => $checkout['payload']['amount'],
            'currency' => $checkout['payload']['currency'],
            'tx_ref' => $txRef,
            'reference' => 'FAKE-'.strtoupper(substr(md5($txRef), 0, 10)),
            'method' => 'test',
        ];
    }

    /** The checkout started for this tx_ref: ['payload' => …, 'status' => pending|success|failed], or null. */
    public function checkout(string $txRef): ?array
    {
        return Cache::get($this->key($txRef));
    }

    /** What the fake checkout page records when the person clicks Pay (success) or Decline (failed). */
    public function complete(string $txRef, string $status): void
    {
        $checkout = $this->checkout($txRef);
        if ($checkout && $checkout['status'] === 'pending') {
            Cache::put($this->key($txRef), ['status' => $status] + $checkout, now()->addDays(self::TTL_DAYS));
        }
    }

    private function key(string $txRef): string
    {
        return 'fake-chapa:'.$txRef;
    }

    private function ensureNotProduction(): void
    {
        if (app()->isProduction()) {
            abort(503, 'CHAPA_MODE=fake is for local development only. Set CHAPA_MODE=test or live with real Chapa keys.');
        }
    }
}
