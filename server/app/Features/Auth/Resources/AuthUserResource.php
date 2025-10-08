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
        ];
    }
}
