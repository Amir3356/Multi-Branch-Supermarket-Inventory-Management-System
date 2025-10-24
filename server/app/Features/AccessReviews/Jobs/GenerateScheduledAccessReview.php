<?php

namespace App\Features\AccessReviews\Jobs;

use App\Features\AccessReviews\Repositories\AccessReviewRepository;
use App\Features\AccessReviews\Services\AccessReviewGenerator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

// Scheduled: a Complete report for the period that just ended (e.g. last month), shown as made "by the schedule"
class GenerateScheduledAccessReview implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $period) {}

    public function handle(AccessReviewGenerator $generator, AccessReviewRepository $reviews): void
    {
        [$start, $end] = $generator->previousPeriod($this->period);

        // Runs at most once per period, even if the scheduler fires again
        if (! $reviews->scheduledExists($this->period, $start, $end)) {
            $generator->generate($start, $end, $this->period, scheduled: true);
        }
    }
}
