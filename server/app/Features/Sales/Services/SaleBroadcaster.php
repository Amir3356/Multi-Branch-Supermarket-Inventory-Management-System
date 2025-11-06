<?php

namespace App\Features\Sales\Services;

use App\Features\Sales\Events\SaleRecorded;
use App\Features\Sales\Models\Sale;
use Illuminate\Support\Facades\Log;
use Throwable;

class SaleBroadcaster
{
    /** Tells the branch's screens after the response; a stopped Reverb server never breaks the sale */
    public function recorded(Sale $sale): void
    {
        dispatch(function () use ($sale) {
            try {
                broadcast(new SaleRecorded($sale));
            } catch (Throwable $e) {
                Log::warning('Live sale update not sent', ['sale' => $sale->id, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
