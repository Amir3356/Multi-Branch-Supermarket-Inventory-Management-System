<?php

namespace App\Features\Stock\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to a branch when its batches change (sold, sent, written off, received, corrected): the new figures, ready to show */
class StockChanged implements ShouldBroadcastNow
{
    public function __construct(public string $branchId, public array $batches) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->branchId}.stock");
    }

    public function broadcastAs(): string
    {
        return 'stock.changed';
    }

    public function broadcastWith(): array
    {
        return ['batches' => $this->batches];
    }
}
