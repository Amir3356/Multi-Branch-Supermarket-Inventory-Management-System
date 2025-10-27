<?php

namespace App\Features\ReturnRequests\Events;

use App\Features\ReturnRequests\Models\ReturnRequest;
use App\Features\ReturnRequests\Resources\ReturnRequestResource;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Pushed over the WebSocket (Reverb) when a return request is sent, approved, rejected or replaced. Every open
 * screen at that branch applies it straight away: the request's status, and the stock it holds or puts back.
 */
class ReturnRequestChanged implements ShouldBroadcastNow
{
    public function __construct(public ReturnRequest $returnRequest) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->returnRequest->branch_id}.return-requests");
    }

    public function broadcastAs(): string
    {
        return 'return-request.changed';
    }

    public function broadcastWith(): array
    {
        return ['request' => (new ReturnRequestResource($this->returnRequest))->resolve()];
    }
}
