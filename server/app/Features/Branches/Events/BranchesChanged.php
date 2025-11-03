<?php

namespace App\Features\Branches\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Pushed over the WebSocket (Reverb) when the Owner adds, edits, (de)activates or deletes a branch: every open screen
 * reloads its branch list, so an inactive branch stops being offered for sales and transfers at once.
 */
class BranchesChanged implements ShouldBroadcastNow
{
    public function __construct(public string $reason) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('branches');
    }

    public function broadcastAs(): string
    {
        return 'branches.changed';
    }
}
