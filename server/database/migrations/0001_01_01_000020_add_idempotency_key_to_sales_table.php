<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The key the Cashier's screen sends with each sale: sending the same sale again (a retry after a lost
        // response, a double tap) finds this row instead of recording the sale twice
        Schema::table('sales', function (Blueprint $table) {
            $table->uuid('idempotency_key')->nullable()->after('sold_by');
            $table->unique(['sold_by', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique(['sold_by', 'idempotency_key']);
            $table->dropColumn('idempotency_key');
        });
    }
};
