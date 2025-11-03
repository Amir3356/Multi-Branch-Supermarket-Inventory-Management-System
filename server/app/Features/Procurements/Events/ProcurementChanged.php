<?php

namespace App\Features\Procurements\Events;

use App\Features\Procurements\Models\Procurement;
use App\Features\Procurements\Resources\ProcurementResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Pushed over the WebSocket (Reverb) when a procurement is created or its payment settles (Paid or Failed). Screens
 * at the receiving branch add a paid procurement's stock to Inventory straight away, without reloading.
 */
class ProcurementChanged implements ShouldBroadcastNow
{
    public function __construct(public Procurement $procurement) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->procurement->branch_id}.procurements");
    }

    public function broadcastAs(): string
    {
        return 'procurement.changed';
    }

    public function broadcastWith(): array
    {
        return ['procurement' => (new ProcurementResource($this->procurement))->resolve()];
    }
}
