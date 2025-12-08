<?php

namespace App\Features\Sales\Models;

use App\Features\Accounts\Models\User;
use App\Shared\Services\Sequences;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sale extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'branch_id', 'customer', 'category', 'product', 'med_id', 'qty', 'batches', 'unit_price', 'total', 'status', 'sold_by', 'idempotency_key'];

    protected function casts(): array
    {
        return ['qty' => 'integer', 'batches' => 'array', 'unit_price' => 'decimal:2', 'total' => 'decimal:2'];
    }

    /** The next free id (SL-00001, …): call inside the transaction that saves it */
    public static function nextId(): string
    {
        return sprintf('SL-%05d', app(Sequences::class)->next('sales'));
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by');
    }
}
