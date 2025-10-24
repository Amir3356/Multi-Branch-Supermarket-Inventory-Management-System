<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An Inventory Officer asking the branch's Procurement Officer to send stock from one batch (one paid
        // procurement) back to its supplier: missing units, damage, expiry, … A supplier return is only recorded
        // by approving one of these.
        Schema::create('return_requests', function (Blueprint $table) {
            $table->id();
            $table->string('procurement_id', 20);
            $table->foreign('procurement_id')->references('id')->on('procurements')->cascadeOnDelete();
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('qty');
            $table->string('reason', 120);
            $table->text('note')->nullable();
            $table->string('status', 20)->default('pending'); // pending | approved | rejected
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->text('response_note')->nullable();
            $table->timestamps();
            $table->index(['branch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_requests');
    }
};
