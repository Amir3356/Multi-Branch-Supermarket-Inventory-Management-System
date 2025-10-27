<?php

namespace App\Features\Procurements\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Create Procurement modal. The total is worked out here from qty × price, never taken from the browser.
class StoreProcurementRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['supplier', 'category', 'product'] as $field) {
            if ($this->has($field)) {
                $this->merge([$field => trim((string) $this->input($field))]);
            }
        }
        $this->merge(['currency' => strtoupper((string) $this->input('currency', 'ETB'))]);
    }

    public function rules(): array
    {
        return [
            'branchId' => ['required', 'string', Rule::exists('branches', 'id')->where('status', 'active'), $this->assignedBranchOnly()],
            'supplier' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:120'],
            'product' => ['required', 'string', 'max:255'],
            'medId' => ['nullable', 'string', 'max:20'],
            'qty' => ['required', 'integer', 'min:1', 'max:1000000'],
            // What the whole order costs; the unit price is worked out from it (Total Cost ÷ Quantity)
            'totalCost' => ['required', 'numeric', 'gt:0', 'max:10000000000'],
            // The currencies Chapa accepts
            'currency' => ['required', Rule::in(['ETB', 'USD'])],
        ];
    }

    // A Procurement Officer receives stock only into the branch the Owner assigned them in Account Provision
    private function assignedBranchOnly(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $user = $this->user();
            if (! $user->isOwner() && $user->branch_id !== $value) {
                $fail($user->branch_id
                    ? 'You can only receive stock into your assigned branch.'
                    : 'You have no assigned branch yet. Ask the Owner to assign one in Account Provision.');
            }
        };
    }

    public function messages(): array
    {
        return [
            'branchId.exists' => 'Choose an active branch.',
            'currency.in' => 'Chapa only accepts payments in ETB or USD. Change the currency in Policy settings.',
        ];
    }
}
