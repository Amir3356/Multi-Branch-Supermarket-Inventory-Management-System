<?php

namespace App\Features\Sessions\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Pushed to the one browser holding this session the moment it ends (ended by the Owner,
 * account deactivated or deleted, password reset), so it signs out immediately.
 */
class SessionEnded implements ShouldBroadcastNow
{
    public function __construct(public int $sessionId, public string $reason) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("session.{$this->sessionId}");
    }

    public function broadcastAs(): string
    {
        return 'session.ended';
    }
}
