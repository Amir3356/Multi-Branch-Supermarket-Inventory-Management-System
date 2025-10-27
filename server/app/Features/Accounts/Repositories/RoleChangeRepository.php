<?php

namespace App\Features\Accounts\Repositories;

use App\Features\Accounts\Models\RoleChange;
use App\Features\Accounts\Models\User;
use App\Shared\Enums\Role;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

// Every database read and write for role changes (kept for access reviews)
class RoleChangeRepository
{
    public function record(User $user, Role|string $from, User $changedBy): RoleChange
    {
        return RoleChange::create([
            'user_id' => $user->id,
            'from_role' => $from,
            'to_role' => $user->role,
            'changed_by' => $changedBy->id,
            'changed_at' => now(),
        ]);
    }

    /** The role (Role) each account had at $asOf, for accounts whose role changed after it (the "from" of the first such change). */
    public function rolesAt(CarbonInterface $asOf): Collection
    {
        return RoleChange::where('changed_at', '>', $asOf)
            ->orderBy('changed_at')
            ->orderBy('id')
            ->get()
            ->unique('user_id')
            ->pluck('from_role', 'user_id');
    }

    /** Changes made between $from and $to, oldest first, grouped by user id. */
    public function betweenByUser(CarbonInterface $from, CarbonInterface $to): Collection
    {
        return RoleChange::whereBetween('changed_at', [$from, $to])->orderBy('changed_at')->get()->groupBy('user_id');
    }
}
