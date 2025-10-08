<?php

namespace App\Features\Accounts\Requests;

use App\Shared\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Email is fixed once invited: to correct it, delete the pending account and invite again
class UpdateAccountRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('fullName')) {
            $this->merge(['fullName' => trim((string) $this->input('fullName'))]);
        }
        if ($this->has('status')) {
            $this->merge(['status' => strtolower((string) $this->input('status'))]);
        }
    }

    public function rules(): array
    {
        return [
            'fullName' => ['sometimes', 'required', 'string', 'max:120'],
            'role' => ['sometimes', 'required', Rule::in(array_map(fn (Role $r) => $r->value, Role::staff()))],
            'branchId' => ['sometimes', 'required', 'string', 'exists:branches,id'],
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive'])],
        ];
    }
}
