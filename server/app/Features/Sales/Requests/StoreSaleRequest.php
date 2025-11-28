<?php

namespace App\Features\Sales\Requests;

use App\Features\Sales\Repositories\SaleRepository;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

// Cashier: a sale at their own, active branch
class StoreSaleRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer' => trim((string) $this->input('customer')) ?: 'Walk-in Customer',
            // Sent as the Idempotency-Key header: one per sale on the Cashier's screen, the same on every retry
            'idempotencyKey' => $this->header('Idempotency-Key'),
        ]);
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
            'idempotencyKey' => ['required', 'uuid'],
            // Which batches the units come from (first in, first out, chosen on the Cashier's screen); they add up to qty
            'batches' => ['required', 'array', 'min:1', 'max:50', $this->addsUpToQty()],
            'batches.*.batch' => ['required', 'string', 'max:50', 'distinct'],
            'batches.*.qty' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'branchId.exists' => 'This branch is inactive, so it can’t record sales.',
            'idempotencyKey.required' => 'This sale is missing its Idempotency-Key header. Reload the page and try again.',
            'idempotencyKey.uuid' => 'The Idempotency-Key header must be a UUID.',
            'batches.required' => 'Choose which batches the units come from.',
        ];
    }

    /**
     * Once the fields are valid: every batch must be in this branch's stock and not expired. The Cashier's screen never
     * offers an expired batch; this stops one arriving another way (an out-of-date screen, a direct API call).
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $batches = array_column($this->input('batches'), 'batch');
            $expiries = app(SaleRepository::class)->batchExpiries($this->input('branchId'), $batches);
            $today = now(config('pharmacy.timezone'))->toDateString();
            foreach ($batches as $batch) {
                if (! array_key_exists($batch, $expiries)) {
                    $validator->errors()->add('batches', "Batch {$batch} isn’t in stock at this branch.");
                } elseif ($expiries[$batch] !== null && $expiries[$batch] < $today) {
                    $date = date('M j, Y', strtotime($expiries[$batch]));
                    $validator->errors()->add('batches', "Batch {$batch} expired on {$date} and can’t be sold.");
                }
            }
        }];
    }

    private function addsUpToQty(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            if (is_array($value) && array_sum(array_map(fn ($b) => (int) ($b['qty'] ?? 0), $value)) !== (int) $this->input('qty')) {
                $fail('The batches must add up to the quantity sold.');
            }
        };
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
