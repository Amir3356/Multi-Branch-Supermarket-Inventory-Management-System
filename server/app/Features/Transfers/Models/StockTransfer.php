<?php

namespace App\Features\Transfers\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransfer extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'from_branch_id', 'to_branch_id', 'category', 'product', 'med_id', 'batch', 'received_batch', 'expiry_date', 'qty', 'status', 'sent_by', 'received_by', 'received_at'];

    protected function casts(): array
    {
        return ['qty' => 'integer', 'expiry_date' => 'date', 'received_at' => 'datetime'];
    }

    /** The next free id: TRF-00001, TRF-00002, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')->map(fn (string $id) => (int) substr($id, 4))->max() ?? 0;

        return sprintf('TRF-%05d', $highest + 1);
    }

    public function isInTransit(): bool
    {
        return $this->status === 'in_transit';
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
