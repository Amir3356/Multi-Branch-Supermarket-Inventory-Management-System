<?php

namespace App\Features\Policies\Events;

use App\Features\Policies\Models\PolicySetting;
use App\Features\Policies\Resources\PolicyResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed over the WebSocket (Reverb) when the policy is saved: every open screen re-flags its stock at once */
class PolicyChanged implements ShouldBroadcastNow
{
    public function __construct(public PolicySetting $policy) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('policy');
    }

    public function broadcastAs(): string
    {
        return 'policy.changed';
    }

    public function broadcastWith(): array
    {
        return ['policy' => (new PolicyResource($this->policy))->resolve()];
    }
}
