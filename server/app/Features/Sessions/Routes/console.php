<?php

use App\Features\Sessions\Jobs\ExpireInactiveSessions;
use App\Features\Sessions\Jobs\PruneOldSessions;
use Illuminate\Support\Facades\Schedule;

Schedule::job(new ExpireInactiveSessions)->everyFiveMinutes()->withoutOverlapping();
Schedule::job(new PruneOldSessions)->dailyAt('02:00')->timezone(config('pharmacy.timezone'));
