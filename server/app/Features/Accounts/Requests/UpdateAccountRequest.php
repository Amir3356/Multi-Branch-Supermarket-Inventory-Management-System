<?php

namespace App\Features\Accounts\Requests;

use App\Shared\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Changing a pending account's email re-sends the invitation to the new address (see AccountController::update)
class UpdateAccountRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('fullName')) {
            $this->merge(['fullName' => trim((string) $this->input('fullName'))]);
        }
        if ($this->has('email')) {
            $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
        }
        if ($this->has('status')) {
            $this->merge(['status' => strtolower((string) $this->input('status'))]);
        }
    }

    public function rules(): array
    {
        return [
            'fullName' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($this->route('account'))],
            'role' => ['sometimes', 'required', Rule::in(array_map(fn (Role $r) => $r->value, Role::staff()))],
            'branchId' => ['sometimes', 'nullable', 'string', 'exists:branches,id'],
            'status' => ['sometimes', 'required', Rule::in(['active', 'inactive'])],
        ];
    }

    public function messages(): array
    {
        return ['email.unique' => 'Another account already uses this email.'];
    }
}
