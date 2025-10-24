<?php

namespace App\Features\Sessions\Jobs;

use App\Features\Sessions\Services\SessionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

// Scheduled: signs out sessions left open past SESSION_TIMEOUT_MINUTES (e.g. a browser closed without
// signing out), so Session Monitoring is right even when nobody has the page open
class ExpireInactiveSessions implements ShouldQueue
{
    use Queueable;

    public function handle(SessionService $sessions): void
    {
        $sessions->expireInactiveSessions();
    }
}
