<?php

namespace App\Features\Accounts\Controllers;

use App\Features\Accounts\Models\User;
use App\Features\Accounts\Repositories\RoleChangeRepository;
use App\Features\Accounts\Repositories\UserRepository;
use App\Features\Accounts\Requests\StoreAccountRequest;
use App\Features\Accounts\Requests\UpdateAccountRequest;
use App\Features\Accounts\Resources\AccountResource;
use App\Features\Accounts\Services\InvitationService;
use App\Features\Sessions\Repositories\SessionRepository;
use App\Features\Sessions\Services\SessionService;
use App\Shared\Enums\AccountStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

// Owner-only: invite, edit, (de)activate and delete staff accounts
class AccountController
{
    public function __construct(
        private InvitationService $invitations,
        private SessionService $sessions,
        private UserRepository $users,
        private RoleChangeRepository $roleChanges,
        private SessionRepository $sessionRecords,
    ) {}

    public function index(): AnonymousResourceCollection
    {
        return AccountResource::collection($this->users->allWithDetails());
    }

    public function store(StoreAccountRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = $this->withMail(fn () => DB::transaction(function () use ($data, $request) {
            $user = $this->users->create([
                'full_name' => $data['fullName'],
                'email' => $data['email'],
                'role' => $data['role'],
                'branch_id' => $data['branchId'],
                'status' => AccountStatus::Invited,
            ]);
            $this->invitations->send($user, $request->user());

            return $user;
        }));

        return response()->json([
            'message' => "Invitation sent to {$user->email}. {$user->full_name} can sign in after setting a password.",
            'account' => new AccountResource($this->users->withDetails($user)),
        ], 201);
    }

    public function update(UpdateAccountRequest $request, User $account): JsonResponse
    {
        $this->ensureEditable($request, $account);
        $data = $request->validated();

        if (isset($data['status']) && $account->status === AccountStatus::Invited) {
            abort(422, "This account hasn't accepted its invitation yet, so it can't be activated or deactivated.");
        }

        $oldEmail = $account->email;
        $account->fill(array_filter([
            'full_name' => $data['fullName'] ?? null,
            'email' => $data['email'] ?? null,
            'role' => $data['role'] ?? null,
            'branch_id' => $data['branchId'] ?? null,
            'status' => $data['status'] ?? null,
        ]));
        $emailChanged = $account->isDirty('email');
        $previousRole = $account->isDirty('role') ? $account->getOriginal('role') : null;
        $reinvite = $emailChanged && $account->status === AccountStatus::Invited;

        $this->withMail(fn () => DB::transaction(function () use ($account, $request, $oldEmail, $emailChanged, $reinvite, $previousRole) {
            $this->users->save($account);

            // Kept for access reviews (privilege creep)
            if ($previousRole) {
                $this->roleChanges->record($account, $previousRole, $request->user());
            }

            if ($emailChanged) {
                // A reset link sent to the old address must stop working
                $this->users->forgetPasswordResets($oldEmail);
            }
            // The old invitation went to the wrong address: replace it and email the new one
            if ($reinvite) {
                $this->invitations->send($account, $request->user());
            }
        }));

        // A deactivated user is signed out everywhere
        if ($account->status === AccountStatus::Inactive) {
            $this->sessions->endAllFor($account, 'Account deactivated');
        }

        $message = "{$account->full_name}'s account was updated.";
        if ($reinvite) {
            $message .= " A new invitation was sent to {$account->email}.";
        } elseif ($emailChanged) {
            $message .= " They now sign in with {$account->email}.";
        }

        return response()->json([
            'message' => $message,
            'account' => new AccountResource($this->users->withDetails($account)),
        ]);
    }

    public function destroy(Request $request, User $account): JsonResponse
    {
        $this->ensureEditable($request, $account);

        $open = $this->sessionRecords->openIdsFor($account);
        DB::transaction(function () use ($account) {
            $this->sessionRecords->deleteAllFor($account);
            $this->users->delete($account);
        });
        $this->sessions->notifyEnded($open, 'Account deleted');
        $this->sessions->announce('removed');

        return response()->json(['message' => "{$account->full_name}'s account was deleted."]);
    }

    public function resendInvitation(Request $request, User $account): JsonResponse
    {
        if ($account->status !== AccountStatus::Invited) {
            abort(422, 'This account has already been set up.');
        }

        $this->withMail(fn () => DB::transaction(fn () => $this->invitations->send($account, $request->user())));

        return response()->json([
            'message' => "A new invitation was sent to {$account->email}.",
            'account' => new AccountResource($this->users->withDetails($account)),
        ]);
    }

    private function ensureEditable(Request $request, User $account): void
    {
        if ($account->isOwner()) {
            abort(403, "The Owner account can't be changed here.");
        }
        if ($account->is($request->user())) {
            abort(403, "You can't change the account you are signed in with.");
        }
    }

    /** Turns an SMTP failure into a clear 503 instead of a bare 500. */
    private function withMail(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (TransportExceptionInterface $e) {
            Log::error('Invitation email failed', ['error' => $e->getMessage()]);
            abort(503, "The invitation email couldn't be sent, so nothing was saved. Check the mail settings and try again.");
        }
    }
}
