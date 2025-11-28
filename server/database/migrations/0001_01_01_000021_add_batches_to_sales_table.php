<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The batches a sale's units came from, first in, first out: [{"batch": "BT-00003", "qty": 5}, …]. Every screen
        // takes the units off these batches, so all of them agree on what is left in each batch.
        Schema::table('sales', function (Blueprint $table) {
            $table->json('batches')->nullable()->after('qty');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('batches');
        });
    }
};
