<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Each API token is one signed-in session; the extra columns let the Owner monitor and end them.
     */
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            // The browser's user agent, shown as "Chrome on Windows"
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            // Where the session was last used from, e.g. "Addis Ababa, Ethiopia"
            $table->string('ip_address', 45)->nullable();
            $table->string('location', 120)->nullable();
            $table->timestamp('last_used_at')->nullable();
            // Set when the session is ended (sign out, ended by the Owner, deactivation, password reset, inactivity)
            $table->timestamp('ended_at')->nullable();
            $table->string('ended_reason', 60)->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};
