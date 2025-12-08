<?php

namespace App\Features\Branches\Models;

use App\Features\Accounts\Models\User;
use App\Shared\Services\Sequences;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'location', 'status'];

    /** The next free id (BR-01, …): call inside the transaction that saves it */
    public static function nextId(): string
    {
        return sprintf('BR-%02d', app(Sequences::class)->next('branches'));
    }

    public function staff(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
