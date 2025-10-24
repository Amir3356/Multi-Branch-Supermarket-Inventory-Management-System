<?php

namespace App\Features\ReturnRequests\Models;

use App\Features\Accounts\Models\User;
use App\Features\Branches\Models\Branch;
use App\Features\Procurements\Models\Procurement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnRequest extends Model
{
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
        return $this->status === 'approved' && $this->replaced_qty === null;
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
