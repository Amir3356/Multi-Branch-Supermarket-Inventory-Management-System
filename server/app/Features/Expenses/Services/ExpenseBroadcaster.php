<?php

namespace App\Features\Expenses\Services;

use App\Features\Expenses\Events\ExpensesChanged;
use Illuminate\Support\Facades\Log;
use Throwable;

class ExpenseBroadcaster
{
    /** Tells the branch's screens after the response; a stopped Reverb server never breaks the change */
    public function changed(string $branchId): void
    {
        dispatch(function () use ($branchId) {
            try {
                broadcast(new ExpensesChanged($branchId));
            } catch (Throwable $e) {
                Log::warning('Live expense update not sent', ['branch' => $branchId, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
