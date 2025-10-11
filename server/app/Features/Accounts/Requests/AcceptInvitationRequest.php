<?php

namespace App\Features\Accounts\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AcceptInvitationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Any password is accepted; it only has to match the confirmation
            'password' => ['required', 'string', 'max:255', 'confirmed'],
        ];
    }
}
