<?php

namespace App\Features\Procurements\Models;

use App\Features\Accounts\Models\User;
use App\Features\Branches\Models\Branch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Procurement extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'branch_id', 'created_by', 'supplier', 'category', 'product', 'med_id', 'qty', 'unit_price', 'total',
        'currency', 'status', 'tx_ref', 'checkout_url', 'chapa_reference', 'payment_method', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'integer',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    /** The next free id: PO-00001, PO-00002, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')
            ->map(fn (string $id) => (int) substr($id, 3))
            ->max() ?? 0;

        return sprintf('PO-%05d', $highest + 1);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
