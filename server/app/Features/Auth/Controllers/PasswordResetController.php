<?php

namespace App\Features\Auth\Controllers;

use App\Features\Accounts\Models\User;
use App\Features\Auth\Requests\ForgotPasswordRequest;
use App\Features\Auth\Requests\ResetPasswordRequest;
use App\Shared\Enums\AccountStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class PasswordResetController
{
    /** Same answer whether or not the email exists, so it can't be used to discover accounts. */
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');

        // Only active accounts can reset; invited ones use their invitation link
        if (User::where('email', $email)->where('status', AccountStatus::Active)->exists()) {
            try {
                Password::sendResetLink(['email' => $email]);
            } catch (TransportExceptionInterface $e) {
                Log::error('Password reset email failed', ['error' => $e->getMessage()]);
                abort(503, "The reset email couldn't be sent right now. Try again in a few minutes.");
            }
        }

        return response()->json([
            'message' => 'If an active account uses that email, a password reset link is on its way.',
        ]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                // Sign out every device that used the old password
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            abort(422, 'This password reset link is invalid or has expired. Request a new one.');
        }

        return response()->json(['message' => 'Your password was reset. Sign in with your new password.']);
    }
}
