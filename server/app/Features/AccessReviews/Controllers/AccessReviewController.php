<?php

namespace App\Features\AccessReviews\Controllers;

use App\Features\AccessReviews\Models\AccessReview;
use App\Features\AccessReviews\Resources\AccessReviewResource;
use App\Features\AccessReviews\Services\AccessReviewGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

// Owner only: access review reports on the Account Provision page
class AccessReviewController
{
    public function __construct(private AccessReviewGenerator $generator) {}

    public function index(): AnonymousResourceCollection
    {
        return AccessReviewResource::collection(
            AccessReview::with(['reviewer', 'generator'])->latest('id')->limit(50)->get()
        );
    }

    /**
     * Generate a report: the current period so far (today, this week/month/quarter/year), the previous
     * finished one (scope=previous: yesterday, last week/month/quarter/year), or a custom date range
     * (from/to, inclusive, not in the future).
     */
    public function store(Request $request): JsonResponse
    {
        // "Today" in the pharmacy's local time, not the server's UTC date
        $today = AccessReviewGenerator::localNow()->toDateString();
        $data = $request->validate([
            'period' => ['required', Rule::in([...AccessReviewGenerator::PERIODS, 'custom'])],
            // current = this period so far (Partial); previous = the last finished one (Complete)
            'scope' => ['nullable', Rule::in(['current', 'previous'])],
            'from' => ['required_if:period,custom', 'nullable', 'date', "before_or_equal:{$today}"],
            'to' => ['required_if:period,custom', 'nullable', 'date', 'after_or_equal:from', "before_or_equal:{$today}"],
        ], [
            'from.required_if' => 'Choose a start date.',
            'to.required_if' => 'Choose an end date.',
            'to.after_or_equal' => 'The end date must be on or after the start date.',
            'from.before_or_equal' => "The start date can't be in the future.",
            'to.before_or_equal' => "The end date can't be in the future.",
        ]);

        [$start, $end] = $data['period'] === 'custom'
            ? [CarbonImmutable::parse($data['from'], config('pharmacy.timezone'))->startOfDay(), CarbonImmutable::parse($data['to'], config('pharmacy.timezone'))->endOfDay()]
            : (($data['scope'] ?? 'current') === 'previous'
                ? $this->generator->previousPeriod($data['period'])
                : $this->generator->currentPeriodToDate($data['period']));
        // Generating the same period again replaces its earlier report with fresh data, instead of piling up copies
        [$review, $replaced] = DB::transaction(function () use ($start, $end, $data, $request) {
            $replaced = AccessReview::where('scheduled', false)
                ->where('period_type', $data['period'])
                ->whereDate('period_start', $start->toDateString())
                ->whereDate('period_end', $end->toDateString())
                ->pluck('id');
            AccessReview::whereKey($replaced)->delete();

            return [$this->generator->generate($start, $end, $data['period'], $request->user()), $replaced];
        });

        return response()->json([
            'message' => $replaced->isEmpty() ? 'Access review generated.' : 'Access review updated with the latest data.',
            'review' => new AccessReviewResource($review->load(['reviewer', 'generator'])),
            // Earlier reports for the same period that this one replaces
            'replacedIds' => $replaced->values(),
        ], 201);
    }

    public function destroy(AccessReview $accessReview): JsonResponse
    {
        $accessReview->delete();

        return response()->json(['message' => 'Access review deleted.']);
    }

    public function show(AccessReview $accessReview): AccessReviewResource
    {
        return new AccessReviewResource($accessReview->load(['reviewer', 'generator']));
    }
}
