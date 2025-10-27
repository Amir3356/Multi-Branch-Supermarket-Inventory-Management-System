<?php

namespace App\Features\ReturnRequests\Models;

use App\Features\Accounts\Models\User;
use App\Features\Branches\Models\Branch;
use App\Features\Procurements\Models\Procurement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnRequest extends Model
{
    // More units arrived than were ordered and paid for. They were never counted into stock, so a request for them
    // moves no stock, isn't limited by the batch, owes no credit and can't be replaced.
    public const EXTRA_QUANTITY = 'Extra quantity';

    protected $fillable = ['procurement_id', 'branch_id', 'requested_by', 'qty', 'reason', 'note', 'status', 'handled_by', 'handled_at', 'response_note', 'replaced_qty', 'replaced_by', 'replaced_at', 'replacement_note'];

    protected function casts(): array
    {
        return ['qty' => 'integer', 'handled_at' => 'datetime', 'replaced_qty' => 'integer', 'replaced_at' => 'datetime'];
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /** Approved, and the supplier hasn't sent replacement units for it yet */
    public function awaitsReplacement(): bool
    {
        return $this->status === 'approved' && $this->replaced_qty === null && ! $this->isExtraQuantity();
    }

    public function isExtraQuantity(): bool
    {
        return $this->reason === self::EXTRA_QUANTITY;
    }

    public function procurement(): BelongsTo
    {
        return $this->belongsTo(Procurement::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function replacer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replaced_by');
    }
}
