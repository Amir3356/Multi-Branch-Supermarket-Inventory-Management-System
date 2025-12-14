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
        $minutes = max(1, (int) config('pharmacy.invitation_expire_minutes'));

        $this->invitations->replaceFor($user, $invitedBy, hash('sha256', $token), now()->addMinutes($minutes));

        $link = rtrim(config('pharmacy.frontend_url'), '/').'/accept-invitation?token='.urlencode($token);

        Mail::to($user->email)->send(new AccountInvitationMail($user, $link, $this->duration($minutes)));
    }

    /** "10 minutes", "2 hours", "3 days": how long the link works, for the email */
    private function duration(int $minutes): string
    {
        [$amount, $unit] = match (true) {
            $minutes % 1440 === 0 => [$minutes / 1440, 'day'],
            $minutes % 60 === 0 => [$minutes / 60, 'hour'],
            default => [$minutes, 'minute'],
        };

        return $amount.' '.$unit.($amount === 1 ? '' : 's');
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
