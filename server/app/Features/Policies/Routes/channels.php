<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Policy changes reach every signed-in user: everyone's stock statuses depend on it
Broadcast::channel('policy', fn (User $user) => true);
