<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

// The Owner, plus ready-to-use staff accounts at one branch (the Owner can still invite more after signing in)
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([OwnerSeeder::class, StaffSeeder::class]);
    }
}
