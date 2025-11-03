<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // The Procurement Officer buys for every branch, so they no longer have one assigned. The move is kept in the
    // account change log, so access reviews of earlier periods still show the branch they had then.
    public function up(): void
    {
        $now = now();
        $officers = DB::table('users')->where('role', 'purchase_officer')->whereNotNull('branch_id')->get(['id', 'branch_id']);

        DB::table('account_changes')->insert($officers->map(fn ($officer) => [
            'user_id' => $officer->id,
            'field' => 'branch',
            'from_value' => $officer->branch_id,
            'to_value' => null,
            'changed_by' => null,
            'changed_at' => $now,
        ])->all());

        DB::table('users')->whereIn('id', $officers->pluck('id'))->update(['branch_id' => null]);
    }

    public function down(): void
    {
        // Their old branch is in account_changes; put it back
        foreach (DB::table('account_changes')->where('field', 'branch')->whereNull('to_value')->whereNull('changed_by')->get() as $change) {
            DB::table('users')->where('id', $change->user_id)->where('role', 'purchase_officer')->update(['branch_id' => $change->from_value]);
        }
    }
};
