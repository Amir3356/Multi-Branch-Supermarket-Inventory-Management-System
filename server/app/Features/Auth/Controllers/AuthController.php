<?php

namespace App\Features\Auth\Controllers;

use App\Features\Accounts\Models\User;
use App\Features\Auth\Requests\LoginRequest;
use App\Features\Auth\Resources\AuthUserResource;
use App\Features\Auth\Services\TokenIssuer;
use App\Shared\Enums\AccountStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function __construct(private TokenIssuer $tokens) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $request->ensureIsNotRateLimited();

        $user = User::where('email', $request->validated('email'))->first();

        // Invited accounts have no password yet, so they fail here too
        if (! $user?->password || ! Hash::check($request->validated('password'), $user->password)) {
            $request->recordFailure();
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        if ($user->status === AccountStatus::Inactive) {
            abort(403, 'This account has been deactivated. Contact the Owner.');
        }

        $request->clearFailures();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json($this->tokens->issue($user, $request));
    }

    public function me(Request $request): AuthUserResource
    {
        return new AuthUserResource($request->user()->load('branch'));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }
}
