<?php

namespace App\Features\Policies\Requests;

use App\Features\Policies\Models\PolicySetting;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePolicyRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'defaultMinStock' => ['required', 'integer', 'min:0', 'max:1000000'],
            'expiryWarningDays' => ['required', 'integer', 'min:1', 'max:'.PolicySetting::MAX_EXPIRY_WARNING_DAYS],
        ];
    }

    public function messages(): array
    {
        return [
            'defaultMinStock.*' => 'Enter a whole number of 0 or more',
            'expiryWarningDays.*' => 'Enter a whole number from 1 to '.PolicySetting::MAX_EXPIRY_WARNING_DAYS,
        ];
    }
}
