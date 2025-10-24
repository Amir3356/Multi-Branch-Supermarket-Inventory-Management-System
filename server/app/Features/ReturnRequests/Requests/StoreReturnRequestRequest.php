<?php

namespace App\Features\ReturnRequests\Requests;

use App\Features\Procurements\Models\Procurement;
use App\Features\ReturnRequests\Repositories\ReturnRequestRepository;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

// Inventory Officer: ask for units of one paid batch at their own branch to go back to the supplier
class StoreReturnRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'procurementId' => ['required', 'string', $this->returnableBatch()],
            'qty' => ['required', 'integer', 'min:1', 'max:1000000', $this->withinBatch()],
            'reason' => ['required', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['procurementId.required' => 'Select the batch number.'];
    }

    public function procurement(): ?Procurement
    {
        return Procurement::find($this->input('procurementId'));
    }

    private function returnableBatch(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $procurement = $this->procurement();
            if (! $procurement || $procurement->status !== 'paid') {
                $fail('Only stock from a paid procurement can be sent back.');
            } elseif ($procurement->branch_id !== $this->user()->branch_id) {
                $fail('You can only request returns for stock at your assigned branch.');
            }
        };
    }

    private function withinBatch(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $procurement = $this->procurement();
            if (! $procurement) {
                return;
            }
            $left = $procurement->qty - app(ReturnRequestRepository::class)->claimedQty($procurement->id);
            if ((int) $value > $left) {
                $fail($left > 0
                    ? "Only {$left} units of this batch can still be requested."
                    : 'Every unit of this batch has already been requested or returned.');
            }
        };
    }
}
