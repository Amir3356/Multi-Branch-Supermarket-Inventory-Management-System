<?php

namespace App\Features\Procurements\Repositories;

use App\Features\Procurements\Models\Procurement;
use App\Shared\Services\BatchNumbers;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Every database read and write for procurements
class ProcurementRepository
{
    public function __construct(private BatchNumbers $batchNumbers) {}

    /** Newest first. */
    public function latest(): Collection
    {
        return Procurement::latest()->get();
    }

    /** A Pending order with the next free id (PO-00001, …) and a unique Chapa transaction reference. */
    public function createPending(array $data, int $createdBy): Procurement
    {
        return DB::transaction(function () use ($data, $createdBy) {
            $id = Procurement::nextId();
            // The officer enters the order's Total Cost; Chapa charges exactly that, and the unit price is derived from it
            $total = round($data['totalCost'], 2);

            return Procurement::create([
                'id' => $id,
                'branch_id' => $data['branchId'],
                'created_by' => $createdBy,
                'supplier' => $data['supplier'],
                'category' => $data['category'],
                'product' => $data['product'],
                'med_id' => $data['medId'] ?? null,
                'qty' => $data['qty'],
                'unit_price' => round($total / $data['qty'], 2),
                'total' => $total,
                'currency' => $data['currency'],
                'status' => 'pending',
                'tx_ref' => $id.'-'.Str::lower(Str::random(12)),
            ]);
        });
    }

    public function findByTxRef(string $txRef): ?Procurement
    {
        return Procurement::where('tx_ref', $txRef)->first();
    }

    /** Re-reads the row and locks it until the surrounding transaction ends. */
    public function lockForUpdate(Procurement $procurement): Procurement
    {
        return Procurement::whereKey($procurement->getKey())->lockForUpdate()->first();
    }

    /** Still pending after at least $minMinutes, created within the last $maxHours: payments to check with Chapa. */
    public function pendingToVerify(int $minMinutes, int $maxHours): Collection
    {
        return Procurement::where('status', 'pending')
            ->where('created_at', '<=', now()->subMinutes($minMinutes))
            ->where('created_at', '>=', now()->subHours($maxHours))
            ->get();
    }

    /** The Inventory Officer added this paid order's stock to their branch: it gets the next batch number */
    public function markReceived(Procurement $procurement, int $receivedBy, string $expiryDate): Procurement
    {
        $procurement->update(['received_at' => now(), 'received_by' => $receivedBy, 'batch' => $this->batchNumbers->next(), 'expiry_date' => $expiryDate]);

        return $procurement;
    }

    public function update(Procurement $procurement, array $attributes): Procurement
    {
        $procurement->update($attributes);

        return $procurement;
    }

    public function delete(Procurement $procurement): void
    {
        $procurement->delete();
    }

    public function fresh(Procurement $procurement): Procurement
    {
        return $procurement->fresh();
    }
}
