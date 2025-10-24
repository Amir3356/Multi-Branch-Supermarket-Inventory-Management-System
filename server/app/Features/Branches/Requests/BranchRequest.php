<?php

namespace App\Features\Branches\Requests;

use App\Features\Branches\Models\Branch;
use App\Features\Branches\Repositories\BranchRepository;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Create (POST) and edit (PATCH) a branch; on edit every field is optional
class BranchRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['name', 'location'] as $field) {
            if ($this->has($field)) {
                $this->merge([$field => trim((string) $this->input($field))]);
            }
        }
        if ($this->has('status')) {
            $this->merge(['status' => strtolower((string) $this->input('status'))]);
        }
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $branch = $this->route('branch');

        return [
            'name' => [$required, 'string', 'max:120', $this->uniqueIgnoringCase($branch)],
            'location' => [$required, 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ];
    }

    // Case-insensitive, since PostgreSQL compares text case-sensitively
    private function uniqueIgnoringCase(?Branch $branch): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($branch) {
            if (app(BranchRepository::class)->nameTaken((string) $value, $branch)) {
                $fail('A branch with this name already exists.');
            }
        };
    }
}
