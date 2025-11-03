<?php

namespace App\Shared\Services;

use Illuminate\Support\Facades\DB;

/**
 * Generated batch numbers (BT-00001, BT-00002, …), one sequence for all stock that enters a branch: paid procurements
 * and received transfers. Call inside the transaction that saves the number.
 */
class BatchNumbers
{
    public function next(): string
    {
        $taken = DB::table('procurements')->where('batch', 'like', 'BT-%')->lockForUpdate()->pluck('batch')
            ->merge(DB::table('stock_transfers')->where('received_batch', 'like', 'BT-%')->lockForUpdate()->pluck('received_batch'));
        $highest = $taken->map(fn (string $batch) => (int) substr($batch, 3))->max() ?? 0;

        return sprintf('BT-%05d', $highest + 1);
    }
}
