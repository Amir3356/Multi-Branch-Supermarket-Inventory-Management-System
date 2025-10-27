<?php

namespace App\Features\Accounts\Models;

use Illuminate\Database\Eloquent\Model;

// One change of an account's status or branch (roles have their own log, RoleChange)
class AccountChange extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'field', 'from_value', 'to_value', 'changed_by', 'changed_at'];

    protected function casts(): array
    {
        return ['changed_at' => 'datetime'];
    }
}
