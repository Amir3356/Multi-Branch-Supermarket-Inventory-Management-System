<?php

namespace App\Features\Sales\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Sales\Models\Sale;
use Illuminate\Support\Collection;
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

    public function create(array $attributes): Sale
    {
        return DB::transaction(fn () => Sale::create($attributes + ['id' => Sale::nextId()]))->load('seller');
    }
}
