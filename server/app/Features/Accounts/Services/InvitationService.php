<?php

namespace App\Features\Accounts\Services;

use App\Features\Accounts\Mail\AccountInvitationMail;
use App\Features\Accounts\Models\AccountInvitation;
use App\Features\Accounts\Models\User;
use App\Features\Accounts\Repositories\AccountChangeRepository;
use App\Features\Accounts\Repositories\InvitationRepository;
use App\Features\Accounts\Repositories\UserRepository;
use App\Shared\Enums\AccountStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class InvitationService
{
    public function __construct(private InvitationRepository $invitations, private UserRepository $users, private AccountChangeRepository $accountChanges) {}

    /**
     * Replaces any earlier invitation for the user and emails a fresh link.
     * Runs inside the caller's transaction, so a failed send rolls everything back.
     */
    public function send(User $user, ?User $invitedBy): void
    {
        $token = Str::random(64);
        $hours = (int) config('pharmacy.invitation_expire_hours');

        $this->invitations->replaceFor($user, $invitedBy, hash('sha256', $token), now()->addHours($hours));

        $link = rtrim(config('pharmacy.frontend_url'), '/').'/accept-invitation?token='.urlencode($token);

        Mail::to($user->email)->send(new AccountInvitationMail($user, $link, $hours));
    }

    /** The pending invitation for a raw token from the link, or null if unknown or already used. */
    public function find(string $token): ?AccountInvitation
    {
        $invitation = $this->invitations->findByTokenHash(hash('sha256', $token));

        return $invitation?->user?->status === AccountStatus::Invited ? $invitation : null;
    }

    /** Sets the password, activates the account and uses up the invitation. */
    public function accept(AccountInvitation $invitation, string $password): User
    {
        return DB::transaction(function () use ($invitation, $password) {
            $user = $invitation->user;
            $this->users->activate($user, $password);
            // Pending → Active, kept for access reviews of past periods
            $this->accountChanges->record($user, 'status', AccountStatus::Invited->value, AccountStatus::Active->value, $user);
            $this->invitations->deleteFor($user);

            return $user;
        });
    }
}
