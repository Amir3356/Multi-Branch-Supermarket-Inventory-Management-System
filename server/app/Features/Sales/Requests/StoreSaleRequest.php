<?php

namespace App\Features\Sales\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Cashier: a sale at their own, active branch
class StoreSaleRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['customer' => trim((string) $this->input('customer')) ?: 'Walk-in Customer']);
    }

    public function rules(): array
    {
        return [
            'branchId' => ['required', 'string', Rule::exists('branches', 'id')->where('status', 'active'), $this->ownBranchOnly()],
            'customer' => ['required', 'string', 'max:120'],
            'category' => ['required', 'string', 'max:120'],
            'product' => ['required', 'string', 'max:255'],
            'medId' => ['nullable', 'string', 'max:20'],
            'qty' => ['required', 'integer', 'min:1', 'max:1000000'],
            'unitPrice' => ['required', 'numeric', 'gt:0', 'max:10000000'],
        ];
    }

    public function messages(): array
    {
        return ['branchId.exists' => 'This branch is inactive, so it can’t record sales.'];
    }

    private function ownBranchOnly(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            if ($this->user()->branch_id !== $value) {
                $fail('You can only record sales at your assigned branch.');
            }
        };
    }
}
