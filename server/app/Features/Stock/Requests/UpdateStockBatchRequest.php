<?php

namespace App\Features\Stock\Requests;

use Illuminate\Foundation\Http\FormRequest;

// Inventory Officer: correct a batch at their own branch (counted units, expiry date)
class UpdateStockBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->route('stockBatch')->branch_id === $this->user()->branch_id;
    }

    public function rules(): array
    {
        return [
            'stock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'expiry' => ['nullable', 'date_format:Y-m-d'],
            // The units the screen showed when the form opened
            'expectedStock' => ['required', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'stock.*' => 'Enter a whole number of 0 or more',
            'expiry.date_format' => 'Enter a valid date',
        ];
    }

    protected function failedAuthorization(): void
    {
        abort(403, 'You can only correct stock at your assigned branch.');
    }
}
