<?php

namespace App\Features\AuditLogs\Models;

use Illuminate\Database\Eloquent\Model;

/** One recorded action. Written once by AuditLogger; there is no way to change or delete it through the API. */
class AuditLog extends Model
{
    public $timestamps = false;

    // The areas of the system an action can belong to, in the order the Owner's filter lists them
    public const MODULES = ['Sign-in', 'Accounts', 'Branches', 'Sessions', 'Access Reviews', 'Products', 'Policy', 'Procurement', 'Stock Transfers', 'Sales', 'Expenses'];

    protected $fillable = ['occurred_at', 'user_id', 'user_name', 'user_role', 'branch_id', 'branch_name', 'module', 'action', 'record_id', 'description', 'ip_address', 'device'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }
}
