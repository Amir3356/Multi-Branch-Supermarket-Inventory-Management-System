<?php

namespace App\Features\Transfers\Models;

use App\Features\Accounts\Models\User;
use App\Shared\Services\Sequences;
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

    /** The next free id (TRF-00001, …): call inside the transaction that saves it */
    public static function nextId(): string
    {
        return sprintf('TRF-%05d', app(Sequences::class)->next('stock_transfers'));
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
