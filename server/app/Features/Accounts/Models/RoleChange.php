<?php

namespace App\Features\Accounts\Models;

use App\Shared\Enums\Role;
use Illuminate\Database\Eloquent\Model;

// One change of a user's role; access reviews use these to spot privilege creep
class RoleChange extends Model
{
    protected $table = 'account_role_changes';

    public $timestamps = false;

    protected $fillable = ['user_id', 'from_role', 'to_role', 'changed_by', 'changed_at'];

    protected function casts(): array
    {
        return ['from_role' => Role::class, 'to_role' => Role::class, 'changed_at' => 'datetime'];
    }
}
