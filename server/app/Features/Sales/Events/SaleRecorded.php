<?php

namespace App\Features\Sales\Events;

use App\Features\Sales\Models\Sale;
use App\Features\Sales\Resources\SaleResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to the branch when a sale is recorded, so every screen there lowers its stock at once */
class SaleRecorded implements ShouldBroadcastNow
{
    public function __construct(public Sale $sale) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->sale->branch_id}.sales");
    }

    public function broadcastAs(): string
    {
        return 'sale.recorded';
    }

    public function broadcastWith(): array
    {
        return ['sale' => (new SaleResource($this->sale))->resolve()];
    }
}
