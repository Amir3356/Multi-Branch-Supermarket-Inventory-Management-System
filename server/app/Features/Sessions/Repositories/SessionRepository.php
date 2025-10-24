<?php

namespace App\Features\Sessions\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Sessions\Models\SessionToken;
use Illuminate\Support\Collection;
use Laravel\Sanctum\NewAccessToken;

// Every database read and write for sessions (Sanctum's personal_access_tokens table)
class SessionRepository
{
    /** A new session (Sanctum token) named after the browser it was issued to. */
    public function createFor(User $user, string $device): NewAccessToken
    {
        return $user->createToken($device);
    }

    /** Sign-ins from the last $days days whose user still exists: open sessions first, then by latest activity. */
    public function recent(int $days): Collection
    {
        return SessionToken::with('tokenable.branch')
            ->where('created_at', '>=', now()->subDays($days))
            ->orderByRaw('ended_at is not null')
            ->orderByRaw('coalesce(last_used_at, created_at) desc')
            ->get()
            ->filter(fn (SessionToken $token) => $token->tokenable !== null)
            ->values();
    }

    /** Deletes rows created more than $days days ago; returns how many. */
    public function pruneOlderThan(int $days): int
    {
        return SessionToken::where('created_at', '<', now()->subDays($days))->delete();
    }

    /** Open sessions not used for the last $minutes minutes. */
    public function openInactiveFor(int $minutes): Collection
    {
        return SessionToken::whereNull('ended_at')
            ->whereRaw('coalesce(last_used_at, created_at) < ?', [now()->subMinutes($minutes)])
            ->get();
    }

    /** Ids of the user's open sessions. */
    public function openIdsFor(User $user): array
    {
        return $user->tokens()->whereNull('ended_at')->pluck('id')->all();
    }

    public function markEnded(SessionToken $token, string $reason): void
    {
        $token->forceFill(['ended_at' => now(), 'ended_reason' => $reason])->save();
    }

    public function markManyEnded(User $user, array $ids, string $reason): void
    {
        $user->tokens()->whereKey($ids)->update(['ended_at' => now(), 'ended_reason' => $reason]);
    }

    public function setAddress(SessionToken $token, string $ip): void
    {
        $token->forceFill(['ip_address' => $ip])->save();
    }

    /** $source: 'ip' (looked up from the address) or 'device' (reported by the browser). */
    public function setLocation(SessionToken $token, string $location, string $source): void
    {
        $token->forceFill(['location' => $location, 'location_source' => $source])->save();
    }

    public function locationSource(SessionToken $token): ?string
    {
        return $token->fresh()?->location_source;
    }

    public function withUser(SessionToken $token): SessionToken
    {
        return $token->load('tokenable.branch');
    }

    public function delete(SessionToken $token): void
    {
        $token->delete();
    }

    /** Signs the user out everywhere by removing every session row (used when the account is deleted). */
    public function deleteAllFor(User $user): void
    {
        $user->tokens()->delete();
    }
}
