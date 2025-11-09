<?php

namespace App\Features\Products\Services;

use App\Features\Products\Events\ProductsChanged;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProductBroadcaster
{
    /** Tells every screen after the response; a stopped Reverb server never breaks the change */
    public function changed(): void
    {
        dispatch(function () {
            try {
                broadcast(new ProductsChanged);
            } catch (Throwable $e) {
                Log::warning('Live catalog update not sent', ['error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
