<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

// Only the Owner is seeded; the Owner creates branches and invites staff after signing in
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(OwnerSeeder::class);
    }
}
