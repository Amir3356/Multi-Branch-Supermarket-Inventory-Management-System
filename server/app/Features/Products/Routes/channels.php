<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Catalog price changes reach every signed-in user
Broadcast::channel('products', fn (User $user) => true);
