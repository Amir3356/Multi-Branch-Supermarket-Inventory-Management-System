<?php

namespace App\Features\Accounts\Models;

use App\Features\Auth\Mail\ResetPasswordMail;
use App\Features\Branches\Models\Branch;
use App\Shared\Enums\AccountStatus;
use App\Shared\Enums\Role;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = ['full_name', 'email', 'password', 'role', 'branch_id', 'status', 'email_verified_at', 'last_login_at'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'role' => Role::class,
            'status' => AccountStatus::class,
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(AccountInvitation::class);
    }

    public function invitation(): HasOne
    {
        return $this->hasOne(AccountInvitation::class)->latestOfMany();
    }

    public function isOwner(): bool
    {
        return $this->role === Role::Owner;
    }

    // Used by Laravel's password broker for "forgot password"
    public function sendPasswordResetNotification($token): void
    {
        Mail::to($this->email)->send(new ResetPasswordMail($this, $token));
    }
}
