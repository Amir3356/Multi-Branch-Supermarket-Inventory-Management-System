<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The pharmacy's policy, shared by every user and branch (one row): when stock counts as Low, and how close to
        // its expiry date a batch counts as Expiring Soon
        Schema::create('policy_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('default_min_stock');
            $table->unsignedSmallInteger('expiry_warning_days');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('policy_settings')->insert(['default_min_stock' => 20, 'expiry_warning_days' => 60, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_settings');
    }
};
