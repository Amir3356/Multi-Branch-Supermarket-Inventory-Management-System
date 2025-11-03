<?php

namespace Database\Seeders;

use App\Features\Accounts\Models\User;
use App\Features\Branches\Models\Branch;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Illuminate\Database\Seeder;

// Ready-to-use branch staff accounts (already Active, with a password), so they can sign in without going through
// an invitation email. The Procurement Officer covers every branch and is invited by the Owner instead.
class StaffSeeder extends Seeder
{
    private const BRANCH = 'Bellema Pharmacy';

    private const PASSWORD = 'AEHJSS36';

    private const STAFF = [
        ['full_name' => 'Asefa Geze', 'email' => 'asefageze1995@gmail.com', 'role' => Role::Pharmacist],
        ['full_name' => 'Hasen Siraj', 'email' => 'hasensiraj1995@gmail.com', 'role' => Role::Cashier],
    ];

    public function run(): void
    {
        $branch = Branch::whereRaw('lower(name) = ?', [mb_strtolower(self::BRANCH)])->first();
        if (! $branch) {
            $this->command?->warn('No branch named '.self::BRANCH.'; add it on the Branches page, then seed again.');

            return;
        }

        foreach (self::STAFF as $staff) {
            // Re-seeding never overwrites an existing account (its password or role may have been changed since)
            if (User::where('email', $staff['email'])->exists()) {
                $this->command?->info("{$staff['email']} already exists; leaving it unchanged.");

                continue;
            }

            User::create($staff + [
                'password' => self::PASSWORD,
                'branch_id' => $branch->id,
                'status' => AccountStatus::Active,
                'email_verified_at' => now(),
            ]);
            $this->command?->info("{$staff['role']->label()} account created for {$staff['email']} at {$branch->name}.");
        }
    }
}
