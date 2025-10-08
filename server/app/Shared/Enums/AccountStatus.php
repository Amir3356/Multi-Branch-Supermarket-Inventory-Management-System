<?php

namespace App\Shared\Enums;

enum AccountStatus: string
{
    // Invitation sent; no password set yet, so the account can't sign in
    case Invited = 'invited';
    case Active = 'active';
    // Blocked by the Owner
    case Inactive = 'inactive';

    public function label(): string
    {
        return match ($this) {
            self::Invited => 'Pending',
            self::Active => 'Active',
            self::Inactive => 'Inactive',
        };
    }
}
