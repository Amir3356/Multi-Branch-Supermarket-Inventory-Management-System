<?php

namespace App\Features\Accounts\Requests;

use App\Shared\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAccountRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'fullName' => trim((string) $this->input('fullName')),
            'email' => strtolower(trim((string) $this->input('email'))),
        ]);
    }

    public function rules(): array
    {
        return [
            'fullName' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in(array_map(fn (Role $r) => $r->value, Role::staff()))],
            // Pharmacists and Cashiers work at one branch; the Procurement Officer covers every branch, so none is set
            'branchId' => [Rule::requiredIf(fn () => Role::tryFrom((string) $this->input('role'))?->coversAllBranches() === false), 'nullable', 'string', 'exists:branches,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Another account already uses this email.',
            'role.in' => 'Choose Pharmacist, Cashier or Procurement Officer.',
            'branchId.exists' => 'Choose a valid branch.',
        ];
    }
}
