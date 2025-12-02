<?php

namespace App\Features\DamagedItems\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DamagedItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branchId' => $this->branch_id,
            'medId' => $this->med_id,
            'product' => $this->product,
            'category' => $this->category,
            'batch' => $this->batch,
            'qty' => $this->qty,
            'reason' => $this->reason,
            'lossValue' => (float) $this->loss_value,
            'date' => $this->damage_date->toDateString(),
            'recordedBy' => $this->recorder?->full_name,
        ];
    }
}
