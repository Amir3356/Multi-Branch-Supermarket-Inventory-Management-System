<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Readable string ids ("BR-01"), generated when the Owner adds a branch
        Schema::create('branches', function (Blueprint $table) {
            $table->string('id', 20)->primary();
            $table->string('name')->unique();
            $table->string('location')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
