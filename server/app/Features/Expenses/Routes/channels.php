<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Live expense changes for one branch: its own staff, and those who cover every branch
Broadcast::channel('branch.{branchId}.expenses', fn (User $user, string $branchId) => $user->coversAllBranches() || $user->branch_id === $branchId);
