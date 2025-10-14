<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every role change, so access reviews can spot privilege creep (e.g. Cashier → Pharmacist)
        Schema::create('account_role_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('from_role', 30);
            $table->string('to_role', 30);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('changed_at')->index();
        });

        // Access review reports the Owner generates for a period (today, this week/quarter/year, or a custom range). Rows are a snapshot of every account at
        // generation time, so a report keeps showing who had access then, whatever changed since.
        Schema::create('access_reviews', function (Blueprint $table) {
            $table->id();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('period_type', 20)->default('quarterly'); // daily | weekly | quarterly | yearly | custom
            $table->boolean('scheduled')->default(false); // made by the former automatic schedule (kept for old reports)
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('summary');
            $table->json('rows');
            // Management sign-off
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_note')->nullable();
            $table->timestamps();
            $table->index(['period_start', 'period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('access_reviews');
        Schema::dropIfExists('account_role_changes');
    }
};
