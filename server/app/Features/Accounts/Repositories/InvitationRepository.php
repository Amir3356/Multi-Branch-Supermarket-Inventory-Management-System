<?php

namespace App\Features\Accounts\Repositories;

use App\Features\Accounts\Models\AccountInvitation;
use App\Features\Accounts\Models\User;
use Carbon\CarbonInterface;

// Every database read and write for account invitations
class InvitationRepository
{
    /** Replaces any earlier invitation for the user with a new one. */
    public function replaceFor(User $user, ?User $invitedBy, string $tokenHash, CarbonInterface $expiresAt): AccountInvitation
    {
        $this->deleteFor($user);

        return $user->invitations()->create([
            'invited_by' => $invitedBy?->id,
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
        ]);
    }

    public function findByTokenHash(string $tokenHash): ?AccountInvitation
    {
        return AccountInvitation::with('user.branch')->where('token_hash', $tokenHash)->first();
    }

    public function deleteFor(User $user): void
    {
        $user->invitations()->delete();
    }
}
