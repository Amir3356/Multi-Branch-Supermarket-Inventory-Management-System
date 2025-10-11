<?php

namespace App\Features\Auth\Controllers;

use App\Features\Accounts\Models\User;
use App\Features\Auth\Requests\ForgotPasswordRequest;
use App\Features\Auth\Requests\ResetPasswordRequest;
use App\Features\Auth\Services\TokenIssuer;
use App\Features\Sessions\Services\SessionService;
use App\Shared\Enums\AccountStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class PasswordResetController
{
    public function __construct(private TokenIssuer $tokens) {}

    /** Tells the person exactly what happened, so they know whether to check their inbox. */
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');
        $user = User::where('email', $email)->first();

        $problem = match ($user?->status) {
            null => "We couldn't find an account with that email address. Check the spelling, or ask the Owner which email your account uses.",
            AccountStatus::Invited => "This account hasn't been set up yet. Use the invitation link in your email to choose a password, or ask the Owner to resend it.",
            AccountStatus::Inactive => 'This account has been deactivated, so its password can\'t be reset. Contact the Owner.',
            AccountStatus::Active => null,
        };
        if ($problem) {
            throw ValidationException::withMessages(['email' => $problem]);
        }

        try {
            $status = Password::sendResetLink(['email' => $email]);
        } catch (TransportExceptionInterface $e) {
            Log::error('Password reset email failed', ['email' => $email, 'error' => $e->getMessage()]);
            abort(503, "The reset email couldn't be sent right now. Try again in a few minutes.");
        }

        // Laravel allows one reset email per account per minute
        if ($status === Password::RESET_THROTTLED) {
            abort(429, "A reset link was sent to {$email} less than a minute ago. Check your inbox and spam folder, or wait a minute and try again.");
        }

        $minutes = (int) config('auth.passwords.users.expire');

        return response()->json([
            'message' => "We sent a password reset link to {$email}. It expires in {$minutes} minutes; if you don't see it, check your spam folder.",
        ]);
    }

    /** Sets the new password, signs out every old session, and signs this browser straight in. */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $resetUser = null;
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use (&$resetUser) {
                $user->forceFill(['password' => $password, 'last_login_at' => now()])->save();
                // Sign out every device that used the old password
                app(SessionService::class)->endAllFor($user, 'Password reset');
                $resetUser = $user;
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            abort(422, 'This password reset link is invalid or has expired. Request a new one.');
        }

        // A fresh session for this browser, like accepting an invitation
        return response()->json(['message' => 'Your password was reset.'] + $this->tokens->issue($resetUser, $request));
    }
}
