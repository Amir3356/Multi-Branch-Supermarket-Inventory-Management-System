<?php

namespace App\Features\Expenses\Requests;

use App\Features\Expenses\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// Inventory Officer: an expense at their own branch, on a day up to today
class StoreExpenseRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['description' => trim((string) $this->input('description')) ?: null]);
    }

    public function rules(): array
    {
        $today = now(config('pharmacy.timezone'))->toDateString();

        return [
            'category' => ['required', Rule::in(Expense::CATEGORIES)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'date' => ['required', 'date_format:Y-m-d', "before_or_equal:{$today}"],
            'description' => [Rule::requiredIf($this->input('category') === 'Other'), 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'category.*' => 'Select a category',
            'amount.*' => 'Enter an amount greater than 0',
            'date.before_or_equal' => 'The date can’t be in the future',
            'date.*' => 'Enter the date it was paid',
            'description.required' => 'Describe what it was for',
        ];
    }
}
