<?php

namespace App\Features\Sessions\Services;

use App\Features\Accounts\Models\User;
use App\Features\Sessions\Events\SessionEnded;
use App\Features\Sessions\Events\SessionsChanged;
use App\Features\Sessions\Models\SessionToken;
use App\Features\Sessions\Repositories\SessionRepository;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * A session is one Sanctum token. Ending a session keeps the row (for the Owner's history)
 * but stamps ended_at, which AppServiceProvider makes Sanctum reject on the next request.
 */
class SessionService
{
    // Activity is pushed to the Owner at most this often per session
    private const ACTIVITY_PUSH_SECONDS = 60;

    // One push per request is enough: the Owner's page reloads the whole list
    private bool $announced = false;

    public function __construct(private SessionRepository $repository) {}

    /**
     * Tells the Owner's page (over the WebSocket) that sessions changed. Sent after the response,
     * once the database changes are committed, and never lets a stopped Reverb server break the request.
     */
    public function announce(string $reason): void
    {
        if ($this->announced) {
            return;
        }
        $this->announced = true;

        dispatch(fn () => $this->broadcast($reason))->afterResponse();
    }

    /** Called for every request made with a token: keeps the IP current and pushes activity now and then. */
    public function recordActivity(SessionToken $token, ?string $ip): void
    {
        // Sanctum hasn't stamped this request yet, so last_used_at is still the previous request's time
        $previous = $token->last_used_at;
        $this->recordAddress($token, $ip);

        if (! $previous || $previous->lte(now()->subSeconds(self::ACTIVITY_PUSH_SECONDS))) {
            $this->announce('activity');
        }
    }

    /**
     * Stores the session's current IP; when it changed, works out the location after the
     * response is sent, so signing in never waits on the lookup.
     */
    public function recordAddress(SessionToken $token, ?string $ip): void
    {
        if (! $ip || ($token->ip_address === $ip && $token->location !== null)) {
            return;
        }

        $this->repository->setAddress($token, $ip);

        // The device's own location (more precise) is kept; the IP only fills in when there's none
        if ($token->location_source === 'device') {
            return;
        }

        dispatch(function () use ($token, $ip) {
            $location = app(IpLocator::class)->locate($ip);
            if ($location && $this->repository->locationSource($token) !== 'device') {
                $this->repository->setLocation($token, $location, 'ip');
                $this->broadcast('location');
            }
        })->afterResponse();
    }

    public const INACTIVITY_REASON = 'Signed out after inactivity';

    /**
     * Ends the session if it hasn't been used for the timeout (SESSION_TIMEOUT_MINUTES).
     * Checked on every request, before Sanctum stamps this one; returns true when it ended it.
     */
    public function expireIfInactive(SessionToken $token): bool
    {
        $minutes = config('pharmacy.session_timeout_minutes');
        $lastUsed = $token->last_used_at ?? $token->created_at;
        if (! $minutes || $lastUsed->gt(now()->subMinutes($minutes))) {
            return false;
        }

        $this->end($token, self::INACTIVITY_REASON);

        return true;
    }

    /** Ends every open session past the timeout, e.g. a browser closed without signing out. */
    public function expireInactiveSessions(): void
    {
        $minutes = config('pharmacy.session_timeout_minutes');
        if (! $minutes) {
            return;
        }

        $this->repository->openInactiveFor($minutes)
            ->each(fn (SessionToken $token) => $this->end($token, self::INACTIVITY_REASON));
    }

    public function end(SessionToken $token, string $reason): void
    {
        if ($token->ended_at === null) {
            $this->repository->markEnded($token, $reason);
            $this->notifyEnded([$token->id], $reason);
            $this->announce('ended');
        }
    }

    /** Signs the user out on every device; returns how many sessions were open. */
    public function endAllFor(User $user, string $reason): int
    {
        $open = $this->repository->openIdsFor($user);
        if (! $open) {
            return 0;
        }

        $this->repository->markManyEnded($user, $open, $reason);
        $this->notifyEnded($open, $reason);
        $this->announce('ended');

        return count($open);
    }

    public function isExpired(SessionToken $token): bool
    {
        $minutes = config('sanctum.expiration');

        return $minutes && $token->created_at->lte(now()->subMinutes($minutes));
    }

    /**
     * Tells each affected browser its session is over, so it signs out at once instead of on its next
     * click. Sent after the response; if Reverb is down, the browser still signs out on its next request.
     */
    public function notifyEnded(array $sessionIds, string $reason): void
    {
        dispatch(function () use ($sessionIds, $reason) {
            foreach ($sessionIds as $id) {
                $this->send(new SessionEnded($id, $reason));
            }
        })->afterResponse();
    }

    private function broadcast(string $reason): void
    {
        $this->send(new SessionsChanged($reason));
    }

    private function send(object $event): void
    {
        try {
            broadcast($event);
        } catch (Throwable $e) {
            // Reverb not running: pages fall back to their regular checks
            Log::warning('Live session update not sent', ['event' => class_basename($event), 'error' => $e->getMessage()]);
        }
    }

    /** "Chrome on Linux" from the browser's user agent (stored as the token name). */
    public static function describeDevice(?string $userAgent): string
    {
        $ua = (string) $userAgent;
        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => 'Browser',
        };
        $os = match (true) {
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Android') => 'Android',
            (bool) preg_match('/iPhone|iPad/', $ua) => 'iOS',
            str_contains($ua, 'Mac OS') => 'macOS',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'Unknown OS',
        };

        return "{$browser} on {$os}";
    }
}
