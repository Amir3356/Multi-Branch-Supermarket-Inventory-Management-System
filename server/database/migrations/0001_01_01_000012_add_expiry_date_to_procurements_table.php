<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The expiration date printed on the package, entered with the batch number when the stock is added
        Schema::table('procurements', function (Blueprint $table) {
            $table->date('expiry_date')->nullable()->after('batch');
        });

        // Stock added before this had no date entered: the app assumed two years from when it was added
        foreach (DB::table('procurements')->whereNotNull('received_at')->get(['id', 'received_at']) as $row) {
            DB::table('procurements')->where('id', $row->id)->update(['expiry_date' => now()->parse($row->received_at)->addYears(2)->toDateString()]);
        }
    }

    public function down(): void
    {
        Schema::table('procurements', function (Blueprint $table) {
            $table->dropColumn('expiry_date');
        });
    }
};
