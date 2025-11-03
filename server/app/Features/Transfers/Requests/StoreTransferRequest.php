<?php

namespace App\Features\Transfers\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Send stock from a branch (staff: their own) to another active branch
class StoreTransferRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'from' => ['required', 'string', Rule::exists('branches', 'id')->where('status', 'active'), $this->ownBranchOnly()],
            'to' => ['required', 'string', 'different:from', Rule::exists('branches', 'id')->where('status', 'active')],
            'category' => ['required', 'string', 'max:120'],
            'product' => ['required', 'string', 'max:255'],
            'medId' => ['nullable', 'string', 'max:20'],
            'batch' => ['required', 'string', 'max:50'],
            'expiry' => ['nullable', 'date_format:Y-m-d'],
            'qty' => ['required', 'integer', 'min:1', 'max:1000000'],
        ];
    }

    public function messages(): array
    {
        return [
            'from.exists' => 'Choose an active sending branch.',
            'to.exists' => 'Choose an active receiving branch.',
            'to.different' => 'Choose a different branch from the sending branch.',
        ];
    }

    private function ownBranchOnly(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $user = $this->user();
            if (! $user->coversAllBranches() && $user->branch_id !== $value) {
                $fail('You can only send stock from your assigned branch.');
            }
        };
    }
}
