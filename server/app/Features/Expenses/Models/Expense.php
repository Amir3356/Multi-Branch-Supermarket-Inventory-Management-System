<?php

namespace App\Features\Expenses\Models;

use App\Features\Accounts\Models\User;
use App\Shared\Services\Sequences;
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

    /** The next free id (EXP-00001, …): call inside the transaction that saves it */
    public static function nextId(): string
    {
        return sprintf('EXP-%05d', app(Sequences::class)->next('expenses'));
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
