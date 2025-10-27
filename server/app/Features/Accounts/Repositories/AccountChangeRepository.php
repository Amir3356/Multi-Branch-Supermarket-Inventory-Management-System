<?php

namespace App\Features\Accounts\Repositories;

use App\Features\Accounts\Models\AccountChange;
use App\Features\Accounts\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

// Every database read and write for status and branch changes
class AccountChangeRepository
{
    /** $field: status | branch */
    public function record(User $user, string $field, ?string $from, ?string $to, ?User $by): void
    {
        AccountChange::create([
            'user_id' => $user->id,
            'field' => $field,
            'from_value' => $from,
            'to_value' => $to,
            'changed_by' => $by?->id,
            'changed_at' => now(),
        ]);
    }

    /**
     * The value each account had at $asOf, for accounts whose $field changed after it: the "from" of their first
     * change after $asOf. Accounts not in the list still have the value they had then.
     */
    public function valuesAt(string $field, CarbonInterface $asOf): Collection
    {
        return AccountChange::where('field', $field)
            ->where('changed_at', '>', $asOf)
            ->orderBy('changed_at')
            ->orderBy('id')
            ->get()
            ->unique('user_id')
            ->pluck('from_value', 'user_id');
    }
}
