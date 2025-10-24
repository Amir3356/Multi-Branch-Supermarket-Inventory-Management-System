<?php

use App\Features\AccessReviews\Jobs\GenerateScheduledAccessReview;
use App\Features\AccessReviews\Services\AccessReviewGenerator;
use Illuminate\Support\Facades\Schedule;

// ACCESS_REVIEW_SCHEDULE: a report for each finished period, just after it ends (pharmacy time); empty = off
$period = config('pharmacy.access_review_schedule');

if (in_array($period, AccessReviewGenerator::PERIODS, true)) {
    $event = Schedule::job(new GenerateScheduledAccessReview($period))->timezone(config('pharmacy.timezone'));
    match ($period) {
        'daily' => $event->dailyAt('01:00'),
        'weekly' => $event->weeklyOn(1, '01:00'),
        'monthly' => $event->monthlyOn(1, '01:00'),
        'quarterly' => $event->quarterlyOn(1, '01:00'),
        'yearly' => $event->yearlyOn(1, 1, '01:00'),
    };
}
