<?php

namespace App\Features\Sales\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branchId' => $this->branch_id,
            'customer' => $this->customer,
            'category' => $this->category,
            'product' => $this->product,
            'medId' => $this->med_id,
            'qty' => $this->qty,
            'unitPrice' => (float) $this->unit_price,
            'total' => (float) $this->total,
            'status' => ucfirst($this->status),
            'date' => $this->created_at->setTimezone(config('pharmacy.timezone'))->toDateString(),
            'soldBy' => $this->seller?->full_name,
        ];
    }
}
