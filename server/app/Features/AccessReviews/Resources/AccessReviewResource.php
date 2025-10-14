<?php

namespace App\Features\AccessReviews\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccessReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'periodStart' => $this->period_start->toDateString(),
            'periodEnd' => $this->period_end->toDateString(),
            'periodType' => $this->period_type,
            'scheduled' => $this->scheduled,
            'generatedAt' => $this->created_at->toIso8601String(),
            // Older reports may have been made by the former automatic schedule
            'generatedBy' => $this->scheduled ? 'Schedule' : $this->generator?->full_name,
            'summary' => $this->summary,
            'reviewedAt' => $this->reviewed_at?->toIso8601String(),
            'reviewedBy' => $this->reviewer?->full_name,
            'reviewNote' => $this->review_note,
            // The full table only when one report is opened
            'rows' => $this->when($request->route('accessReview') !== null, fn () => $this->rows),
        ];
    }
}
