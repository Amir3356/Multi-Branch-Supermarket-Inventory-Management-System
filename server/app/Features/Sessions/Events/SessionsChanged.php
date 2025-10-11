<?php

namespace App\Features\Sessions\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Pushed over the WebSocket (Reverb) whenever someone signs in or out, a session is ended,
 * or a session's activity/location changes. The Owner's page reloads its list when it arrives.
 */
class SessionsChanged implements ShouldBroadcastNow
{
    public function __construct(public string $reason) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('sessions');
    }

    public function broadcastAs(): string
    {
        return 'sessions.changed';
    }
}
