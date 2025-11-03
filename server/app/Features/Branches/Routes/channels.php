<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Branch list changes reach every signed-in user: every page labels and offers branches
Broadcast::channel('branches', fn (User $user) => true);
