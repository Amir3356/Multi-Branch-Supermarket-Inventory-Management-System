<?php

namespace App\Features\Branches\Services;

use App\Features\Branches\Events\BranchesChanged;
use Illuminate\Support\Facades\Log;
use Throwable;

class BranchBroadcaster
{
    /** Tells every screen after the response; a stopped Reverb server never breaks the change */
    public function changed(string $reason): void
    {
        dispatch(function () use ($reason) {
            try {
                broadcast(new BranchesChanged($reason));
            } catch (Throwable $e) {
                Log::warning('Live branch update not sent', ['error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
