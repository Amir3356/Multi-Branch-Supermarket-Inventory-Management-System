<?php

namespace App\Features\Accounts\Models;

use Illuminate\Database\Eloquent\Model;

// One sign-in; access reviews of a past period use the last one on or before its end
class SignIn extends Model
{
    protected $table = 'account_sign_ins';

    public $timestamps = false;

    protected $fillable = ['user_id', 'signed_in_at', 'recorded_at'];

    protected function casts(): array
    {
        return ['signed_in_at' => 'datetime', 'recorded_at' => 'datetime'];
    }
}
