<?php

namespace App\Features\Expenses\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Pushed to a branch when an expense is recorded or deleted, so its open screens reload the list */
class ExpensesChanged implements ShouldBroadcastNow
{
    public function __construct(public string $branchId) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("branch.{$this->branchId}.expenses");
    }

    public function broadcastAs(): string
    {
        return 'expenses.changed';
    }
}
