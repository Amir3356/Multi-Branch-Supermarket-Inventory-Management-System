<?php

namespace App\Features\Sales\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sale extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'branch_id', 'customer', 'category', 'product', 'med_id', 'qty', 'unit_price', 'total', 'status', 'sold_by'];

    protected function casts(): array
    {
        return ['qty' => 'integer', 'unit_price' => 'decimal:2', 'total' => 'decimal:2'];
    }

    /** The next free id: SL-00001, SL-00002, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')->map(fn (string $id) => (int) substr($id, 3))->max() ?? 0;

        return sprintf('SL-%05d', $highest + 1);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by');
    }
}
