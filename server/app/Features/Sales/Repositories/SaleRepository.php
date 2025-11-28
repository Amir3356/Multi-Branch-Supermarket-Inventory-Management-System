<?php

namespace App\Features\Sales\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Sales\Models\Sale;
use Illuminate\Support\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

// Every database read and write for sales
class SaleRepository
{
    /** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
    public function visibleTo(User $user): Collection
    {
        return Sale::with('seller')
            ->when(! $user->coversAllBranches(), fn ($query) => $query->where('branch_id', $user->branch_id))
            ->latest()
            ->get();
    }

    /**
     * Each batch's expiry date (YYYY-MM-DD, or null when none was recorded) at a branch, for the batches given. A batch
     * is in a branch's stock once its procurement was added there (Add Medicine) or a transfer was received there under
     * it; batches missing from the result never arrived at that branch.
     */
    public function batchExpiries(string $branchId, array $batches): array
    {
        $fromProcurements = DB::table('procurements')
            ->where('branch_id', $branchId)->whereNotNull('received_at')->whereIn('batch', $batches)
            ->pluck('expiry_date', 'batch');
        $fromTransfers = DB::table('stock_transfers')
            ->where('to_branch_id', $branchId)->where('status', 'received')->whereIn('received_batch', $batches)
            ->pluck('expiry_date', 'received_batch');

        return $fromTransfers->merge($fromProcurements)->map(fn ($date) => $date ? substr((string) $date, 0, 10) : null)->all();
    }

    /** The sale this cashier already recorded with this idempotency key, if any */
    public function findByIdempotencyKey(int $userId, string $key): ?Sale
    {
        return Sale::with('seller')->where('sold_by', $userId)->where('idempotency_key', $key)->first();
    }

    /**
     * Records the sale once per cashier and idempotency key. Returns [sale, created]: when the key was already used
     * (a retry, or two copies of the same request at the same moment) it returns the earlier sale and false.
     */
    public function createOnce(array $attributes): array
    {
        if ($existing = $this->findByIdempotencyKey($attributes['sold_by'], $attributes['idempotency_key'])) {
            return [$existing, false];
        }

        try {
            return [$this->create($attributes), true];
        } catch (UniqueConstraintViolationException $e) {
            // The other copy got in first: the unique (sold_by, idempotency_key) index stopped this one
            $existing = $this->findByIdempotencyKey($attributes['sold_by'], $attributes['idempotency_key']);
            if (! $existing) {
                throw $e;
            }

            return [$existing, false];
        }
    }

    public function create(array $attributes): Sale
    {
        return DB::transaction(fn () => Sale::create($attributes + ['id' => Sale::nextId()]))->load('seller');
    }
}
