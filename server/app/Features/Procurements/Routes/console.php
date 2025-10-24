<?php

use App\Features\Procurements\Jobs\VerifyPendingProcurements;
use Illuminate\Support\Facades\Schedule;

Schedule::job(new VerifyPendingProcurements)->everyFiveMinutes()->withoutOverlapping();
