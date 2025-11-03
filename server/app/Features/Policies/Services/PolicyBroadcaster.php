<?php

namespace App\Features\Policies\Services;

use App\Features\Policies\Events\PolicyChanged;
use App\Features\Policies\Models\PolicySetting;
use Illuminate\Support\Facades\Log;
use Throwable;

class PolicyBroadcaster
{
    /** Sends the new policy after the response; a stopped Reverb server never breaks the save */
    public function changed(PolicySetting $policy): void
    {
        dispatch(function () use ($policy) {
            try {
                broadcast(new PolicyChanged($policy));
            } catch (Throwable $e) {
                Log::warning('Live policy update not sent', ['error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
