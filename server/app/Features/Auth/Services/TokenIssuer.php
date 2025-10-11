<?php

namespace App\Features\Auth\Services;

use App\Features\Accounts\Models\User;
use App\Features\Auth\Resources\AuthUserResource;
use App\Features\Sessions\Services\SessionService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TokenIssuer
{
    /** A new API token (one session) named after the browser that asked for it, plus the user payload. */
    public function issue(User $user, Request $request): array
    {
        $device = Str::limit((string) $request->userAgent() ?: 'Unknown device', 120, '');

        $token = $user->createToken($device);
        // Shown to the Owner in Session Monitoring
        $sessions = app(SessionService::class);
        $sessions->recordAddress($token->accessToken, $request->ip());
        $sessions->announce('signed-in');

        return [
            'token' => $token->plainTextToken,
            'user' => (new AuthUserResource($user->loadMissing('branch')))->resolve($request),
        ];
    }
}
