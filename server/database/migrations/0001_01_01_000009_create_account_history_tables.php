<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every sign-in (login, accepting an invitation, password reset), kept for good: access reviews of a past
        // period use the last sign-in on or before its end. recorded_at is when the row was written, so the
        // earliest one marks when this history began.
        Schema::create('account_sign_ins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('signed_in_at');
            $table->timestamp('recorded_at'); // set by the app (UTC), not the database clock
            $table->index(['user_id', 'signed_in_at']);
        });

        // Status and branch changes, like account_role_changes for roles: access reviews of a past period show
        // each account as it was at the period's end
        Schema::create('account_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('field', 20); // status | branch
            $table->string('from_value', 30)->nullable();
            $table->string('to_value', 30)->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('changed_at')->index();
            $table->index(['user_id', 'field']);
        });

        // Each account's latest sign-in is the one sign-in already known; earlier ones were never recorded
        $recordedAt = now();
        DB::table('account_sign_ins')->insert(
            DB::table('users')->whereNotNull('last_login_at')->get(['id', 'last_login_at'])
                ->map(fn ($user) => ['user_id' => $user->id, 'signed_in_at' => $user->last_login_at, 'recorded_at' => $recordedAt])
                ->all()
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('account_changes');
        Schema::dropIfExists('account_sign_ins');
    }
};
