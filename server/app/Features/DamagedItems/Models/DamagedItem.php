<?php

namespace App\Features\DamagedItems\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DamagedItem extends Model
{
    // Why stock was written off; the client offers the same list
    public const REASONS = [
        'Broken / crushed packaging',
        'Water damage',
        'Contaminated',
        'Temperature damage (cold chain)',
        'Defective item',
        'Other',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'branch_id', 'med_id', 'product', 'category', 'batch', 'qty', 'reason', 'loss_value', 'damage_date', 'recorded_by'];

    protected function casts(): array
    {
        return ['qty' => 'integer', 'loss_value' => 'decimal:2', 'damage_date' => 'date'];
    }

    /** The next free id: DMG-00001, DMG-00002, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')->map(fn (string $id) => (int) substr($id, 4))->max() ?? 0;

        return sprintf('DMG-%05d', $highest + 1);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
