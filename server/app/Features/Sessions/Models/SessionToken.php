<?php

namespace App\Features\Sessions\Models;

use Laravel\Sanctum\PersonalAccessToken;

// Sanctum's token, which is one signed-in session, plus the columns Session Monitoring adds
class SessionToken extends PersonalAccessToken
{
    protected $table = 'personal_access_tokens';

    protected function casts(): array
    {
        return parent::casts() + ['ended_at' => 'datetime'];
    }
}
