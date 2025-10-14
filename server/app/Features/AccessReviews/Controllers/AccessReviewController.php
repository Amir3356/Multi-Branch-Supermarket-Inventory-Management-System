<?php

namespace App\Features\AccessReviews\Controllers;

use App\Features\AccessReviews\Models\AccessReview;
use App\Features\AccessReviews\Resources\AccessReviewResource;
use App\Features\AccessReviews\Services\AccessReviewGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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
     * Generate a report now: today, this week, this quarter or this year so far,
     * or a custom date range (from/to, inclusive, not in the future).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => ['required', Rule::in([...AccessReviewGenerator::PERIODS, 'custom'])],
            'from' => ['required_if:period,custom', 'nullable', 'date', 'before_or_equal:today'],
            'to' => ['required_if:period,custom', 'nullable', 'date', 'after_or_equal:from', 'before_or_equal:today'],
        ], [
            'from.required_if' => 'Choose a start date.',
            'to.required_if' => 'Choose an end date.',
            'to.after_or_equal' => 'The end date must be on or after the start date.',
            'from.before_or_equal' => "The start date can't be in the future.",
            'to.before_or_equal' => "The end date can't be in the future.",
        ]);

        [$start, $end] = $data['period'] === 'custom'
            ? [CarbonImmutable::parse($data['from'])->startOfDay(), CarbonImmutable::parse($data['to'])->endOfDay()]
            : $this->generator->currentPeriodToDate($data['period']);
        $review = $this->generator->generate($start, $end, $data['period'], $request->user());

        return response()->json([
            'message' => 'Access review generated.',
            'review' => new AccessReviewResource($review->load(['reviewer', 'generator'])),
        ], 201);
    }

    public function show(AccessReview $accessReview): AccessReviewResource
    {
        return new AccessReviewResource($accessReview->load(['reviewer', 'generator']));
    }

    /** Management sign-off, with an optional note on what was done. */
    public function review(Request $request, AccessReview $accessReview): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $accessReview->update([
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
            'review_note' => $data['note'] ?? null,
        ]);

        return response()->json([
            'message' => 'Access review marked as reviewed.',
            'review' => new AccessReviewResource($accessReview->load(['reviewer', 'generator'])),
        ]);
    }
}
