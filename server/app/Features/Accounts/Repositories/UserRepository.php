<?php

namespace App\Features\Accounts\Repositories;

use App\Features\Accounts\Models\User;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for user accounts (also used by Auth and Access Reviews)
class UserRepository
{
    /** Every account with its branch and latest invitation, oldest first. */
    public function allWithDetails(): Collection
    {
        return User::with(['branch', 'invitation'])->orderBy('id')->get();
    }

    /** Accounts that existed at $asOf, with their branch, oldest first. */
    public function createdBy(CarbonInterface $asOf): Collection
    {
        return User::with('branch')->where('created_at', '<=', $asOf)->orderBy('id')->get();
    }

    public function findByEmail(string $email): ?User
    {
        return User::where('email', $email)->first();
    }

    public function ownerExists(): bool
    {
        return User::where('role', Role::Owner)->exists();
    }

    public function create(array $attributes): User
    {
        return User::create($attributes);
    }

    public function save(User $user): void
    {
        $user->save();
    }

    /** Fields that aren't mass assignable from a request, such as last_login_at. */
    public function forceUpdate(User $user, array $attributes): void
    {
        $user->forceFill($attributes)->save();
    }

    public function recordLogin(User $user): void
    {
        $this->forceUpdate($user, ['last_login_at' => now()]);
    }

    /** Sets the password and activates the account (accepting an invitation). */
    public function activate(User $user, string $password): void
    {
        $user->update([
            'password' => $password,
            'status' => AccountStatus::Active,
            // Opening the emailed link proves they own the address
            'email_verified_at' => now(),
            'last_login_at' => now(),
        ]);
    }

    public function delete(User $user): void
    {
        $user->delete();
    }

    /** A reset link sent to this address stops working. */
    public function forgetPasswordResets(string $email): void
    {
        DB::table('password_reset_tokens')->where('email', $email)->delete();
    }

    public function withDetails(User $user): User
    {
        return $user->load(['branch', 'invitation']);
    }

    public function withBranch(User $user): User
    {
        return $user->load('branch');
    }
}
