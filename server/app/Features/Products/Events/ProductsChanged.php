<?php

namespace App\Features\Products\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed when a product's prices change: every screen reloads the catalog (e.g. a cashier can sell it right away) */
class ProductsChanged implements ShouldBroadcastNow
{
    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('products');
    }

    public function broadcastAs(): string
    {
        return 'products.changed';
    }
}
