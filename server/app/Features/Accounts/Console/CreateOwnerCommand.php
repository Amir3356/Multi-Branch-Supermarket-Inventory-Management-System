<?php

namespace App\Features\Accounts\Console;

use App\Features\Accounts\Models\User;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

// The Owner isn't invited by anyone, so the first account is created here
class CreateOwnerCommand extends Command
{
    protected $signature = 'owner:create';

    protected $description = 'Create the Owner account that provisions all staff accounts';

    public function handle(): int
    {
        if (User::where('role', Role::Owner)->exists()) {
            $this->error('An Owner account already exists.');

            return self::FAILURE;
        }

        $name = text('Full name', required: true);
        $email = strtolower(text('Email', required: true, validate: ['email' => 'email:rfc|unique:users,email']));
        $password = password('Password', required: true);

        User::create([
            'full_name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => Role::Owner,
            'branch_id' => null,
            'status' => AccountStatus::Active,
            'email_verified_at' => now(),
        ]);

        $this->info("Owner account created for {$email}. Sign in from the web app.");

        return self::SUCCESS;
    }
}
