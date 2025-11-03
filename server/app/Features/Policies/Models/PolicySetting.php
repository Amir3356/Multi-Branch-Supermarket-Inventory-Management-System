<?php

namespace App\Features\Policies\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// The pharmacy's single policy row
class PolicySetting extends Model
{
    public const MAX_EXPIRY_WARNING_DAYS = 730;

    protected $fillable = ['default_min_stock', 'expiry_warning_days', 'updated_by'];

    protected function casts(): array
    {
        return ['default_min_stock' => 'integer', 'expiry_warning_days' => 'integer'];
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
