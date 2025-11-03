<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Live return request changes for one branch: its own staff, and those who cover every branch (Owner, Procurement Officer)
Broadcast::channel('branch.{branchId}.return-requests', fn (User $user, string $branchId) => $user->coversAllBranches() || $user->branch_id === $branchId);
