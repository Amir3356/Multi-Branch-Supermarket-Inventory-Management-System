<?php

namespace App\Features\Auth\Services;

use App\Features\Accounts\Models\User;
use App\Features\Auth\Resources\AuthUserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TokenIssuer
{
    /** A new API token named after the browser that asked for it, plus the user payload. */
    public function issue(User $user, Request $request): array
    {
        $device = Str::limit((string) $request->userAgent() ?: 'Unknown device', 120, '');

        return [
            'token' => $user->createToken($device)->plainTextToken,
            'user' => (new AuthUserResource($user->loadMissing('branch')))->resolve($request),
        ];
    }
}
