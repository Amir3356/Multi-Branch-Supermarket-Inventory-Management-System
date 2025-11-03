<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Stock sent from one branch to another. It leaves the sending branch when sent (In Transit) and enters the
        // receiving branch's Inventory only when its Inventory Officer adds it (Add Medicine): then it is Received.
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "TRF-00001"
            $table->string('from_branch_id', 20);
            $table->foreign('from_branch_id')->references('id')->on('branches');
            $table->string('to_branch_id', 20);
            $table->foreign('to_branch_id')->references('id')->on('branches');
            $table->string('category');
            $table->string('product');
            $table->string('med_id', 20)->nullable(); // the client catalog's product id
            $table->string('batch', 50);
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('qty');
            $table->string('status', 20)->default('in_transit'); // in_transit | received
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->index(['from_branch_id', 'status']);
            $table->index(['to_branch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfers');
    }
};
