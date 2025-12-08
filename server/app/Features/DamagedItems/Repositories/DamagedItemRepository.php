<?php

namespace App\Features\DamagedItems\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\DamagedItems\Models\DamagedItem;
use App\Features\Stock\Repositories\StockRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for damaged items
class DamagedItemRepository
{
    public function __construct(private StockRepository $stock) {}

    /** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
    public function visibleTo(User $user): Collection
    {
        return DamagedItem::with('recorder')
            ->when(! $user->coversAllBranches(), fn ($query) => $query->where('branch_id', $user->branch_id))
            ->orderByDesc('damage_date')
            ->orderByDesc('id')
            ->get();
    }

    /** What one unit of the product cost to buy (its latest purchase price), or 0 when none was recorded */
    public function unitCost(?string $medId): float
    {
        return $medId ? (float) DB::table('products')->where('id', $medId)->value('purchase_price') : 0.0;
    }

    /** The record and the units leaving the batch are saved together; expired batches can be written off too */
    public function create(array $attributes): DamagedItem
    {
        return DB::transaction(function () use ($attributes) {
            $this->stock->take($attributes['branch_id'], $attributes['product'], $attributes['batch'], (int) $attributes['qty']);

            return DamagedItem::create($attributes + ['id' => DamagedItem::nextId()]);
        })->load('recorder');
    }
}
