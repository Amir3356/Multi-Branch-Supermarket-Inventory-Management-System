<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

// The Owner, ready-to-use staff accounts at one branch (the Owner can still invite more), and the product catalog
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([OwnerSeeder::class, StaffSeeder::class, ProductSeeder::class]);
    }
}
