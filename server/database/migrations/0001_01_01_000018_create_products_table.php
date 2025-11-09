<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The product catalog every branch buys, stocks and sells from (the same for every user)
        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "MED-101"
            $table->string('name');
            $table->string('category', 120)->index();
            // Shared by every branch: what one unit cost when it was last added to stock, and what it sells for
            $table->decimal('purchase_price', 12, 2)->nullable();
            $table->decimal('selling_price', 12, 2)->nullable();
            $table->foreignId('price_set_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['category', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
