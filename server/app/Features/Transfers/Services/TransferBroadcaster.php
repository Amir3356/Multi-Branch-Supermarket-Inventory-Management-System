<?php

namespace App\Features\Transfers\Services;

use App\Features\Transfers\Events\TransferChanged;
use App\Features\Transfers\Models\StockTransfer;
use Illuminate\Support\Facades\Log;
use Throwable;

class TransferBroadcaster
{
    /** Tells both branches' screens after the response; a stopped Reverb server never breaks the transfer */
    public function changed(StockTransfer $transfer): void
    {
        dispatch(function () use ($transfer) {
            try {
                broadcast(new TransferChanged($transfer));
            } catch (Throwable $e) {
                Log::warning('Live transfer update not sent', ['transfer' => $transfer->id, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
