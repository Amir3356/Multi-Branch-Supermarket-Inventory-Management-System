<?php

namespace App\Features\Accounts\Repositories;

use App\Features\Accounts\Models\SignIn;
use App\Features\Accounts\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

// Every database read and write for the sign-in history
class SignInRepository
{
    public function record(User $user): void
    {
        $now = now();
        SignIn::create(['user_id' => $user->id, 'signed_in_at' => $now, 'recorded_at' => $now]);
    }

    /** Each user's last sign-in on or before $asOf: user id => time. */
    public function lastAtOrBefore(CarbonInterface $asOf): Collection
    {
        return SignIn::where('signed_in_at', '<=', $asOf)
            ->groupBy('user_id')
            ->selectRaw('user_id, max(signed_in_at) as last_signed_in_at')
            ->pluck('last_signed_in_at', 'user_id')
            ->map(fn ($time) => CarbonImmutable::parse($time, config('app.timezone')));
    }

    /** When sign-ins started being recorded; before it, only each account's latest sign-in was known. */
    public function historyStart(): ?CarbonImmutable
    {
        $first = SignIn::min('recorded_at');

        return $first ? CarbonImmutable::parse($first, config('app.timezone')) : null;
    }
}
