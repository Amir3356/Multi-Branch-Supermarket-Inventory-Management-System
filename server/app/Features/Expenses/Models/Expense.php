<?php

namespace App\Features\Expenses\Models;

use App\Features\Accounts\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    // What a branch spends on; the client offers the same list
    public const CATEGORIES = [
        'Rent',
        'Transportation',
        'Utilities (Electricity & Water)',
        'Salaries & Wages',
        'Maintenance & Repairs',
        'Supplies & Stationery',
        'Communication (Phone & Internet)',
        'Taxes & Licenses',
        'Cleaning & Security',
        'Other',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'branch_id', 'category', 'description', 'amount', 'expense_date', 'recorded_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'expense_date' => 'date'];
    }

    /** The next free id: EXP-00001, EXP-00002, … */
    public static function nextId(): string
    {
        $highest = static::pluck('id')->map(fn (string $id) => (int) substr($id, 4))->max() ?? 0;

        return sprintf('EXP-%05d', $highest + 1);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
