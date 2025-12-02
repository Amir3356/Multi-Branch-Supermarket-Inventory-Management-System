<?php

namespace App\Features\DamagedItems\Events;

use App\Features\DamagedItems\Models\DamagedItem;
use App\Features\DamagedItems\Resources\DamagedItemResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to the branch when damaged stock is written off, so every screen there lowers its stock at once */
class DamageRecorded implements ShouldBroadcastNow
{
    public function __construct(public DamagedItem $item) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->item->branch_id}.damaged");
    }

    public function broadcastAs(): string
    {
        return 'damage.recorded';
    }

    public function broadcastWith(): array
    {
        return ['damagedItem' => (new DamagedItemResource($this->item))->resolve()];
    }
}
