<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A purchase order and the Chapa payment that settles it. Stock is received only once it is paid.
        Schema::create('procurements', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "PO-00001"
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('supplier');
            $table->string('category');
            $table->string('product');
            $table->string('med_id', 20)->nullable(); // the client catalog's product id, when the product already existed
            $table->unsignedInteger('qty');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total', 12, 2);
            $table->string('currency', 3);
            $table->string('status', 20)->default('pending'); // pending | paid | failed

            // Chapa
            $table->string('tx_ref', 64)->unique();
            $table->text('checkout_url')->nullable();
            $table->string('chapa_reference')->nullable();
            $table->string('payment_method')->nullable();
            $table->timestamp('paid_at')->nullable();

            $table->timestamps();
            $table->index(['branch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurements');
    }
};
