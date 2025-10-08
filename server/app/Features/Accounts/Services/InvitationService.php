<?php

namespace App\Features\Accounts\Services;

use App\Features\Accounts\Mail\AccountInvitationMail;
use App\Features\Accounts\Models\AccountInvitation;
use App\Features\Accounts\Models\User;
use App\Shared\Enums\AccountStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class InvitationService
{
    /**
     * Replaces any earlier invitation for the user and emails a fresh link.
     * Runs inside the caller's transaction, so a failed send rolls everything back.
     */
    public function send(User $user, ?User $invitedBy): void
    {
        $token = Str::random(64);
        $hours = (int) config('pharmacy.invitation_expire_hours');

        $user->invitations()->delete();
        $user->invitations()->create([
            'invited_by' => $invitedBy?->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addHours($hours),
        ]);

        $link = rtrim(config('pharmacy.frontend_url'), '/').'/accept-invitation?token='.urlencode($token);

        Mail::to($user->email)->send(new AccountInvitationMail($user, $link, $hours));
    }

    /** The pending invitation for a raw token from the link, or null if unknown or already used. */
    public function find(string $token): ?AccountInvitation
    {
        $invitation = AccountInvitation::with('user.branch')
            ->where('token_hash', hash('sha256', $token))
            ->first();

        return $invitation?->user?->status === AccountStatus::Invited ? $invitation : null;
    }

    /** Sets the password, activates the account and uses up the invitation. */
    public function accept(AccountInvitation $invitation, string $password): User
    {
        return DB::transaction(function () use ($invitation, $password) {
            $user = $invitation->user;
            $user->update([
                'password' => $password,
                'status' => AccountStatus::Active,
                // Opening the emailed link proves they own the address
                'email_verified_at' => now(),
                'last_login_at' => now(),
            ]);
            $user->invitations()->delete();

            return $user;
        });
    }
}
