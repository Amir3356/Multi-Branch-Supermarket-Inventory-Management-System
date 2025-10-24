<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The supplier sent good units in place of an approved return: they go back into the same batch,
        // with no new payment, and settle that much of the supplier's credit
        Schema::table('return_requests', function (Blueprint $table) {
            $table->unsignedInteger('replaced_qty')->nullable()->after('response_note');
            $table->foreignId('replaced_by')->nullable()->after('replaced_qty')->constrained('users')->nullOnDelete();
            $table->timestamp('replaced_at')->nullable()->after('replaced_by');
            $table->text('replacement_note')->nullable()->after('replaced_at');
        });
    }

    public function down(): void
    {
        Schema::table('return_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('replaced_by');
            $table->dropColumn(['replaced_qty', 'replaced_at', 'replacement_note']);
        });
    }
};
