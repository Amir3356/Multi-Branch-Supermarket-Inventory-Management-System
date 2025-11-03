<?php

namespace App\Features\Transfers\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from' => $this->from_branch_id,
            'to' => $this->to_branch_id,
            'category' => $this->category,
            'product' => $this->product,
            'medId' => $this->med_id,
            // The sending branch's batch, and the new one the receiving branch added it under
            'batch' => $this->batch,
            'receivedBatch' => $this->received_batch,
            'expiry' => $this->expiry_date?->toDateString(),
            'qty' => $this->qty,
            // Pending until the receiving branch adds it to stock (Add Medicine), then Received
            'status' => $this->isInTransit() ? 'Pending' : 'Received',
            'date' => $this->created_at->setTimezone(config('pharmacy.timezone'))->toDateString(),
            'sentBy' => $this->sender?->full_name,
            'receivedBy' => $this->receiver?->full_name,
            'receivedAt' => $this->received_at?->toIso8601String(),
        ];
    }
}
