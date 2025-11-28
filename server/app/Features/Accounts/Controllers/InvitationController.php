<?php

namespace App\Features\Accounts\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Accounts\Models\AccountInvitation;
use App\Features\Accounts\Requests\AcceptInvitationRequest;
use App\Features\Accounts\Services\InvitationService;
use App\Features\Auth\Services\TokenIssuer;
use Illuminate\Http\JsonResponse;

// Public: the invited person opens the emailed link, then sets a password
class InvitationController
{
    public function __construct(
        private InvitationService $invitations,
        private TokenIssuer $tokens,
    ) {}

    public function show(string $token): JsonResponse
    {
        $invitation = $this->usable($token);
        $user = $invitation->user;

        return response()->json([
            'fullName' => $user->full_name,
            'email' => $user->email,
            'roleLabel' => $user->role->label(),
            'branchName' => $user->branch?->name,
            'expiresAt' => $invitation->expires_at->toIso8601String(),
        ]);
    }

    /** Sets the password and signs the person straight in. */
    public function accept(AcceptInvitationRequest $request, string $token): JsonResponse
    {
        $user = $this->invitations->accept($this->usable($token), $request->validated('password'));
        app(AuditLogger::class)->record('Accounts', 'Invitation accepted', (string) $user->id, "{$user->full_name} ({$user->email}) set a password and signed in for the first time.", $user->branch_id, $user);

        return response()->json($this->tokens->issue($user, $request));
    }

    private function usable(string $token): AccountInvitation
    {
        $invitation = $this->invitations->find($token)
            ?? abort(404, 'This invitation link is invalid or has already been used.');

        if ($invitation->isExpired()) {
            abort(410, 'This invitation link has expired. Ask the Owner to resend it.');
        }

        return $invitation;
    }
}
