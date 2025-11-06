<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A sale recorded by a branch's Cashier. Its units leave that branch's stock.
        Schema::create('sales', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "SL-00001"
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->string('customer')->default('Walk-in Customer');
            $table->string('category');
            $table->string('product');
            $table->string('med_id', 20)->nullable(); // the client catalog's product id
            $table->unsignedInteger('qty');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total', 12, 2);
            $table->string('status', 20)->default('paid');
            $table->foreignId('sold_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['branch_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
