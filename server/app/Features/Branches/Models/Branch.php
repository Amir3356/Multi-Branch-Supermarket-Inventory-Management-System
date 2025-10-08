<?php

namespace App\Features\Branches\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'location', 'status'];

    /** The next free id: BR-01, BR-02, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')
            ->map(fn (string $id) => (int) substr($id, 3))
            ->max() ?? 0;

        return sprintf('BR-%02d', $highest + 1);
    }

    public function staff(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
