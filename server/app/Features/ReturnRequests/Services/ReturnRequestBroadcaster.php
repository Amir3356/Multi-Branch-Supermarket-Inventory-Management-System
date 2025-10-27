<?php

namespace App\Features\ReturnRequests\Services;

use App\Features\ReturnRequests\Events\ReturnRequestChanged;
use App\Features\ReturnRequests\Models\ReturnRequest;
use Illuminate\Support\Facades\Log;
use Throwable;

class ReturnRequestBroadcaster
{
    /**
     * Sends the change to the branch's screens after the response, once the database change is committed,
     * and never lets a stopped Reverb server break the request (screens catch up when they reconnect).
     */
    public function changed(ReturnRequest $returnRequest): void
    {
        dispatch(function () use ($returnRequest) {
            try {
                broadcast(new ReturnRequestChanged($returnRequest));
            } catch (Throwable $e) {
                Log::warning('Live return request update not sent', ['request' => $returnRequest->id, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
