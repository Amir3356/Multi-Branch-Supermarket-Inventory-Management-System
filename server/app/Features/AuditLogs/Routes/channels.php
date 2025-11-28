<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// New audit log entries: only the Owner may listen
Broadcast::channel('audit-logs', fn (User $user) => $user->isOwner());
