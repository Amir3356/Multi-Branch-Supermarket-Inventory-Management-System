<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Live stock for one branch: its own staff, and those who cover every branch (Owner, Procurement Officer)
Broadcast::channel('branch.{branchId}.stock', fn (User $user, string $branchId) => $user->coversAllBranches() || $user->branch_id === $branchId);
