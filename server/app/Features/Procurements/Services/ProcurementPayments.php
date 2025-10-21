<?php

namespace App\Features\Procurements\Services;

use App\Features\Accounts\Models\User;
use App\Features\Procurements\Models\Procurement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProcurementPayments
{
    public function __construct(private ChapaClient $chapa) {}

    /** Asks Chapa for a checkout page for this procurement and keeps its URL so the payment can be resumed. */
    public function startCheckout(Procurement $procurement, User $payer): string
    {
        [$firstName, $lastName] = array_pad(explode(' ', trim($payer->full_name), 2), 2, '');

        $checkoutUrl = $this->chapa->initialize([
            'amount' => number_format((float) $procurement->total, 2, '.', ''),
            'currency' => $procurement->currency,
            'email' => $payer->email,
            'first_name' => $firstName,
            'last_name' => $lastName ?: $firstName,
            'tx_ref' => $procurement->tx_ref,
            // Chapa calls this server-to-server; it must be publicly reachable (it won't be on localhost)
            'callback_url' => url('/api/procurements/chapa/callback'),
            // Where the person lands after paying; the Procurement page verifies from there
            'return_url' => rtrim(config('pharmacy.frontend_url'), '/').'/purchases?procurement='.$procurement->id,
            'customization' => [
                'title' => 'Procurement', // Chapa allows at most 16 characters
                // Only letters, numbers, spaces, dots, hyphens and underscores are accepted
                'description' => Str::limit(preg_replace('/[^A-Za-z0-9 ._-]/', '', "{$procurement->id} {$procurement->qty} x {$procurement->product}"), 50, ''),
            ],
        ]);

        $procurement->update(['checkout_url' => $checkoutUrl]);

        return $checkoutUrl;
    }

    /**
     * Checks the payment with Chapa and records the outcome. Safe to call any number of times
     * (return page, callback, retries): a procurement is marked paid only once.
     */
    public function sync(Procurement $procurement): Procurement
    {
        if (! $procurement->isPending()) {
            return $procurement;
        }

        $transaction = $this->chapa->verify($procurement->tx_ref);
        if (! $transaction) {
            return $procurement; // not paid yet
        }

        return DB::transaction(function () use ($procurement, $transaction) {
            $procurement = Procurement::whereKey($procurement->getKey())->lockForUpdate()->first();
            if (! $procurement->isPending()) {
                return $procurement;
            }

            $status = $transaction['status'] ?? null;
            $amountMatches = round((float) ($transaction['amount'] ?? 0), 2) >= round((float) $procurement->total, 2)
                && strtoupper($transaction['currency'] ?? '') === $procurement->currency;

            if ($status === 'success' && $amountMatches) {
                $procurement->update([
                    'status' => 'paid',
                    'paid_at' => now(),
                    'chapa_reference' => $transaction['reference'] ?? null,
                    'payment_method' => $transaction['method'] ?? $transaction['payment_method'] ?? null,
                ]);
            } elseif ($status === 'failed' || ($status === 'success' && ! $amountMatches)) {
                $procurement->update(['status' => 'failed']);
            }

            return $procurement;
        });
    }
}
