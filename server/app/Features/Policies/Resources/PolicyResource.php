<?php

namespace App\Features\Policies\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'defaultMinStock' => $this->default_min_stock,
            'expiryWarningDays' => $this->expiry_warning_days,
            'updatedBy' => $this->editor?->full_name,
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
