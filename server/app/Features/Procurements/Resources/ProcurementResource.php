<?php

namespace App\Features\Procurements\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

// Shaped like the React app's purchase rows; a paid one also carries its row for "Payment & Transaction History"
class ProcurementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $timezone = config('pharmacy.timezone');
        $isPaid = $this->status === 'paid';

        return [
            'id' => $this->id,
            'branchId' => $this->branch_id,
            'supplier' => $this->supplier,
            'category' => $this->category,
            'product' => $this->product,
            'medId' => $this->med_id,
            'qty' => $this->qty,
            'purchasePrice' => (float) $this->unit_price,
            'total' => (float) $this->total,
            'currency' => $this->currency,
            'date' => $this->created_at->setTimezone($timezone)->toDateString(),
            'status' => ucfirst($this->status),
            // Lets the officer finish a payment they left half way
            'checkoutUrl' => $this->isPending() ? $this->checkout_url : null,
            // Set when the receiving branch's Inventory Officer added the stock (Add Medicine); until then it isn't in stock
            'receivedAt' => $this->received_at?->toIso8601String(),
            // The batch number generated when the stock was added (older orders: their procurement ID)
            'batch' => $this->batch,
            // …and its expiration date (YYYY-MM-DD)
            'expiryDate' => $this->expiry_date?->toDateString(),
            'payment' => $isPaid ? [
                'id' => $this->chapa_reference ?: $this->tx_ref,
                'purchaseId' => $this->id,
                'branchId' => $this->branch_id,
                'supplier' => $this->supplier,
                'method' => $this->payment_method ? 'Chapa · '.ucfirst($this->payment_method) : 'Chapa',
                'amount' => (float) $this->total,
                'date' => $this->paid_at->setTimezone($timezone)->toDateString(),
                'status' => 'Cleared',
            ] : null,
        ];
    }
}
