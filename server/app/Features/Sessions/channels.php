<?php

use App\Features\Accounts\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Live session updates: only the Owner may listen
Broadcast::channel('sessions', fn (User $user) => $user->isOwner());

// "Your session was ended": only the browser holding that very session may listen
Broadcast::channel('session.{sessionId}', fn (User $user, string $sessionId) => (string) $user->currentAccessToken()?->id === $sessionId);
