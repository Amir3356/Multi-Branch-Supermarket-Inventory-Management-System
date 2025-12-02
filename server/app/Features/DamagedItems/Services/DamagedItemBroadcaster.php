<?php

namespace App\Features\DamagedItems\Services;

use App\Features\DamagedItems\Events\DamageRecorded;
use App\Features\DamagedItems\Models\DamagedItem;
use Illuminate\Support\Facades\Log;
use Throwable;

class DamagedItemBroadcaster
{
    /** Tells the branch's screens after the response; a stopped Reverb server never breaks the write-off */
    public function recorded(DamagedItem $item): void
    {
        dispatch(function () use ($item) {
            try {
                broadcast(new DamageRecorded($item));
            } catch (Throwable $e) {
                Log::warning('Live damage update not sent', ['damagedItem' => $item->id, 'error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
