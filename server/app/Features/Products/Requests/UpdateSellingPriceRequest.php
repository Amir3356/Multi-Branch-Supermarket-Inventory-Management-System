<?php

namespace App\Features\Products\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSellingPriceRequest extends FormRequest
{
    public function rules(): array
    {
        return ['sellingPrice' => ['required', 'numeric', 'gt:0', 'max:10000000']];
    }

    public function messages(): array
    {
        return ['sellingPrice.*' => 'Enter a selling price greater than 0'];
    }
}
