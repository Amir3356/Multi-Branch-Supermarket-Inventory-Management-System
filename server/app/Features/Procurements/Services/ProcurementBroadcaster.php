<?php

namespace App\Features\Procurements\Services;

use App\Features\Procurements\Events\ProcurementChanged;
use App\Features\Procurements\Models\Procurement;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcurementBroadcaster
{
    /**
     * Sends the change to the receiving branch's screens after the response, once the database change is committed,
     * and never lets a stopped Reverb server break the request (screens catch up when they reconnect).
     */
    public function changed(Procurement $procurement): void
    {
        dispatch(function () use ($procurement) {
            try {
                broadcast(new ProcurementChanged($procurement->fresh() ?? $procurement));
            } catch (Throwable $e) {
                Log::warning('Live procurement update not sent', ['procurement' => $procurement->id, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
