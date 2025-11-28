<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Who did what, where and when: one row per important action, written by the server and never edited. Names
        // are copied in, so the history still reads correctly after an account or branch is renamed or deleted.
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->timestamp('occurred_at')->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name', 255)->nullable(); // or the email typed in, for a failed sign-in
            $table->string('user_role', 40)->nullable();
            $table->string('branch_id', 20)->nullable()->index(); // the branch the action concerns
            $table->string('branch_name', 120)->nullable();
            $table->string('module', 40)->index();
            $table->string('action', 80);
            $table->string('record_id', 60)->nullable();
            $table->text('description');
            $table->string('ip_address', 45)->nullable();
            $table->string('device', 120)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
