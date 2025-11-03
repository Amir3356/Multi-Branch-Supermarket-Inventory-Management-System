<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The receiving branch adds transferred stock under a new generated batch number (BT-00001, …); `batch` keeps
        // the sending branch's number, so the stock can still be traced back
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->string('received_batch', 50)->nullable()->after('batch');
        });

        // Transfers received before this kept the sending branch's batch
        DB::table('stock_transfers')->where('status', 'received')->update(['received_batch' => DB::raw('batch')]);
    }

    public function down(): void
    {
        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->dropColumn('received_batch');
        });
    }
};
