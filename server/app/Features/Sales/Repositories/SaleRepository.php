<?php

namespace App\Features\Sales\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Sales\Models\Sale;
use App\Features\Stock\Repositories\StockRepository;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for sales
class SaleRepository
{
    public function __construct(private StockRepository $stock) {}

    /** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
    public function visibleTo(User $user): Collection
    {
        return Sale::with('seller')
            ->when(! $user->coversAllBranches(), fn ($query) => $query->where('branch_id', $user->branch_id))
            ->latest()
            ->get();
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

    /**
     * The sale and the units leaving its batches are saved together. Not enough units left (another Cashier sold them a
     * moment ago) cancels both with a 422. The sale row goes in first, so a second copy with the same idempotency key
     * waits for this one and then gets the unique-index error createOnce turns into a replay.
     */
    public function create(array $attributes): Sale
    {
        return DB::transaction(function () use ($attributes) {
            $sale = Sale::create($attributes + ['id' => Sale::nextId()]);
            $this->stock->takeMany($sale->branch_id, $sale->product, $attributes['batches'], expiredAction: 'sold');

            return $sale;
        })->load('seller');
    }
}
