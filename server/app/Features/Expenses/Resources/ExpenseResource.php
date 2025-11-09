<?php

namespace App\Features\Expenses\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branchId' => $this->branch_id,
            'category' => $this->category,
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'date' => $this->expense_date->toDateString(),
            'recordedBy' => $this->recorder?->full_name,
        ];
    }
}
