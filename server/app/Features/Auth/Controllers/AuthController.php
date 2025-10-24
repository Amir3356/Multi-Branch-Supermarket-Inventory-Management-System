<?php

namespace App\Features\Auth\Controllers;

use App\Features\Accounts\Repositories\UserRepository;
use App\Features\Auth\Requests\LoginRequest;
use App\Features\Auth\Resources\AuthUserResource;
use App\Features\Auth\Services\TokenIssuer;
use App\Features\Sessions\Services\SessionService;
use App\Shared\Enums\AccountStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController
{
    public function __construct(private TokenIssuer $tokens, private SessionService $sessions, private UserRepository $users) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $request->ensureIsNotRateLimited();

        $user = $this->users->findByEmail($request->validated('email'));

        // Invited accounts have no password yet, so they fail here too
        if (! $user?->password || ! Hash::check($request->validated('password'), $user->password)) {
            $request->recordFailure();
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        if ($user->status === AccountStatus::Inactive) {
            abort(403, 'This account has been deactivated. Contact the Owner.');
        }

        $request->clearFailures();
        $this->users->recordLogin($user);

        return response()->json($this->tokens->issue($user, $request));
    }

    public function me(Request $request): AuthUserResource
    {
        return new AuthUserResource($this->users->withBranch($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        // The browser's inactivity timer signs out with reason "inactivity"
        $reason = $request->input('reason') === 'inactivity' ? SessionService::INACTIVITY_REASON : 'Signed out';
        $this->sessions->end($request->user()->currentAccessToken(), $reason);

        return response()->json(['message' => 'Signed out.']);
    }
}
