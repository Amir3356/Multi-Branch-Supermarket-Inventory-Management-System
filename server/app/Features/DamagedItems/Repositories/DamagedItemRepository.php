<?php

namespace App\Features\DamagedItems\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\DamagedItems\Models\DamagedItem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for damaged items
class DamagedItemRepository
{
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

    public function create(array $attributes): DamagedItem
    {
        return DB::transaction(fn () => DamagedItem::create($attributes + ['id' => DamagedItem::nextId()]))->load('recorder');
    }
}
