<?php

namespace App\Features\Auth\Resources;

use App\Features\Accounts\Resources\AccountResource;
use Illuminate\Http\Request;

// The signed-in user plus what their role may open; the client builds the sidebar from `sections`
class AuthUserResource extends AccountResource
{
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'sections' => $this->role->sections(),
            'homeSection' => $this->role->homeSection(),
            // The browser signs out after this many minutes without use (0 = never)
            'sessionTimeoutMinutes' => config('pharmacy.session_timeout_minutes'),
        ];
    }
}
