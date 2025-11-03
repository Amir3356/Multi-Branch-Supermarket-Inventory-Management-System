<?php

namespace App\Features\ReturnRequests\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReturnRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $procurement = $this->procurement;

        return [
            'id' => $this->id,
            'procurementId' => $this->procurement_id,
            // Each paid procurement is received as one batch: the number entered when it arrived
            'batch' => $procurement?->batch ?? $this->procurement_id,
            'branchId' => $this->branch_id,
            'supplier' => $procurement?->supplier,
            'category' => $procurement?->category,
            'product' => $procurement?->product,
            'medId' => $procurement?->med_id,
            'qty' => $this->qty,
            'reason' => $this->reason,
            'note' => $this->note,
            // Approved returns become Replaced (or Partially Replaced) once the supplier sends good units back
            'status' => match (true) {
                $this->replaced_qty === null => ucfirst($this->status),
                $this->replaced_qty >= $this->qty => 'Replaced',
                default => 'Partially Replaced',
            },
            'requestedBy' => $this->requester?->full_name,
            'requestedAt' => $this->created_at->toIso8601String(),
            'handledBy' => $this->handler?->full_name,
            'handledAt' => $this->handled_at?->toIso8601String(),
            'responseNote' => $this->response_note,
            'replacedQty' => $this->replaced_qty,
            'replacedBy' => $this->replacer?->full_name,
            'replacedAt' => $this->replaced_at?->toIso8601String(),
            'replacementNote' => $this->replacement_note,
        ];
    }
}
