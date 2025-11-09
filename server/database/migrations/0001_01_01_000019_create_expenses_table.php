<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A branch's running costs (rent, transportation, utilities, …), recorded by its Inventory Officer
        Schema::create('expenses', function (Blueprint $table) {
            $table->string('id', 20)->primary(); // "EXP-00001"
            $table->string('branch_id', 20);
            $table->foreign('branch_id')->references('id')->on('branches');
            $table->string('category', 60);
            $table->string('description', 255)->nullable();
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['branch_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
