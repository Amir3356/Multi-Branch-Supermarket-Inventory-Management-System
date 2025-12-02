<?php

namespace App\Features\DamagedItems\Requests;

use App\Features\DamagedItems\Models\DamagedItem;
use App\Features\Sales\Repositories\SaleRepository;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

// Inventory Officer: damaged stock from a batch that arrived at their own branch
class StoreDamagedItemRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'medId' => ['nullable', 'string', 'max:20'],
            'product' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:120'],
            'batch' => ['required', 'string', 'max:50'],
            'qty' => ['required', 'integer', 'min:1', 'max:1000000'],
            'reason' => ['required', Rule::in(DamagedItem::REASONS)],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $branchId = $this->user()->branch_id;
                if (! $branchId || $validator->errors()->has('batch')) {
                    return;
                }
                // The same check a sale gets: the batch must have been added to this branch's stock
                if (! array_key_exists($this->input('batch'), app(SaleRepository::class)->batchExpiries($branchId, [$this->input('batch')]))) {
                    $validator->errors()->add('batchKey', "Batch {$this->input('batch')} isn’t in stock at your branch.");
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'qty.*' => 'Enter a whole number of at least 1',
            'reason.*' => 'Select a reason',
        ];
    }
}
