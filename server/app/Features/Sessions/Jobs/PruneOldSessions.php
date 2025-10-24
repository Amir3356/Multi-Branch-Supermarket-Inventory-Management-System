<?php

namespace App\Features\Sessions\Jobs;

use App\Features\Sessions\Repositories\SessionRepository;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

// Scheduled housekeeping: rows older than 30 days can't sign in (tokens expire after 7) and are never shown
class PruneOldSessions implements ShouldQueue
{
    use Queueable;

    public const KEEP_DAYS = 30;

    public function handle(SessionRepository $sessions): void
    {
        $sessions->pruneOlderThan(self::KEEP_DAYS);
    }
}
