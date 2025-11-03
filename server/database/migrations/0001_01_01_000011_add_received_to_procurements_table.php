<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A paid procurement's stock enters the branch's Inventory only when its Inventory Officer adds it (Add
        // Medicine), not by itself when the payment settles. Until then its delivery is Pending; after, Arrived, with
        // a generated batch number.
        Schema::table('procurements', function (Blueprint $table) {
            $table->timestamp('received_at')->nullable()->after('paid_at');
            $table->foreignId('received_by')->nullable()->after('received_at')->constrained('users')->nullOnDelete();
            $table->string('batch', 50)->nullable()->after('received_by');
        });

        // Orders paid before this change already went into stock automatically, under their procurement ID as batch
        DB::table('procurements')->where('status', 'paid')->update(['received_at' => DB::raw('paid_at'), 'batch' => DB::raw('id')]);
    }

    public function down(): void
    {
        Schema::table('procurements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('received_by');
            $table->dropColumn(array_values(array_filter(['received_at', 'batch'], fn ($column) => Schema::hasColumn('procurements', $column))));
        });
    }
};
