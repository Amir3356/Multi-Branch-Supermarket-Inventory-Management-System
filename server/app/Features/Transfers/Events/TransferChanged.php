<?php

namespace App\Features\Transfers\Events;

use App\Features\Transfers\Models\StockTransfer;
use App\Features\Transfers\Resources\TransferResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to both branches when a transfer is sent or received, so both Inventories update at once */
class TransferChanged implements ShouldBroadcastNow
{
    public function __construct(public StockTransfer $transfer) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->transfer->from_branch_id}.transfers"),
            new PrivateChannel("branch.{$this->transfer->to_branch_id}.transfers"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'transfer.changed';
    }

    public function broadcastWith(): array
    {
        return ['transfer' => (new TransferResource($this->transfer))->resolve()];
    }
}
