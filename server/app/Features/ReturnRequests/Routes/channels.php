<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Live return request changes for one branch: its own staff, and the Owner (who sees every branch)
Broadcast::channel('branch.{branchId}.return-requests', fn (User $user, string $branchId) => $user->isOwner() || $user->branch_id === $branchId);
