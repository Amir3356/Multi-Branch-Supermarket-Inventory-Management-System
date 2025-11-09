<?php

namespace App\Features\Expenses\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Expenses\Models\Expense;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for expenses
class ExpenseRepository
{
    /** Newest first: every branch for those who cover all branches, otherwise the user's own branch */
    public function visibleTo(User $user): Collection
    {
        return Expense::with('recorder')
            ->when(! $user->coversAllBranches(), fn ($query) => $query->where('branch_id', $user->branch_id))
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get();
    }

    public function create(array $attributes): Expense
    {
        return DB::transaction(fn () => Expense::create($attributes + ['id' => Expense::nextId()]))->load('recorder');
    }

    public function delete(Expense $expense): void
    {
        $expense->delete();
    }
}
