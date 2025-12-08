<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Corrections an Inventory Officer makes to a batch on the Inventory screen (counted stock, expiry date). Kept so the
 * change is on record, and so `php artisan stock:rebuild` replays them instead of losing them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->string('product');
            $table->string('batch', 50);
            $table->integer('units_before');
            $table->integer('units_after');
            $table->date('expiry_before')->nullable();
            $table->date('expiry_after')->nullable();
            $table->foreignId('adjusted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at');
            $table->index(['branch_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
