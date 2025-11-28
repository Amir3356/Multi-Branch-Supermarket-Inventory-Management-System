<?php

namespace App\Features\AuditLogs\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to the Owner's Audit Logs page when an action is recorded; the page reloads its list */
class AuditLogRecorded implements ShouldBroadcastNow
{
    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('audit-logs');
    }

    public function broadcastAs(): string
    {
        return 'audit-log.recorded';
    }
}
