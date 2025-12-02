<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Stock written off as damaged by a branch's Inventory Officer. Its units leave that branch's stock, and its loss
        // value (units × the product's purchase price when it was recorded) comes off the Owner's net profit.
        Schema::create('damaged_items', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "DMG-00001"
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->string('med_id', 20)->nullable(); // the client catalog's product id
            $table->string('product');
            $table->string('category');
            $table->string('batch', 50);
            $table->unsignedInteger('qty');
            $table->string('reason', 120);
            $table->decimal('loss_value', 12, 2);
            $table->date('damage_date');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['branch_id', 'damage_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('damaged_items');
    }
};
