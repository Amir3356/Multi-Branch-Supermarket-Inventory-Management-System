<?php

namespace Database\Seeders;

use App\Features\Accounts\Models\User;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Illuminate\Database\Seeder;

// Creates the Owner account, who then invites every other staff member
class OwnerSeeder extends Seeder
{
    private const OWNER = [
        'full_name' => 'Amir Siraj',
        'email' => 'amirsiraj1995@gmail.com',
        'password' => 'AEHJSS36',
    ];

    public function run(): void
    {
        // Re-seeding never overwrites an existing Owner (their password may have been changed since)
        if (User::where('role', Role::Owner)->exists()) {
            $this->command?->info('An Owner account already exists; leaving it unchanged.');

            return;
        }

        User::create(self::OWNER + [
            'role' => Role::Owner,
            'branch_id' => null,
            'status' => AccountStatus::Active,
            'email_verified_at' => now(),
        ]);

        $this->command?->info('Owner account created for '.self::OWNER['email'].'.');
    }
}
