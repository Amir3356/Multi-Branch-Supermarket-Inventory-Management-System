<?php

namespace App\Features\AuditLogs\Repositories;

use App\Features\AuditLogs\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

// Every database read and write for audit logs
class AuditLogRepository
{
    public function create(array $attributes): AuditLog
    {
        return AuditLog::create($attributes);
    }

    /**
     * Newest first, filtered: `from`/`to` are calendar days in the pharmacy's time zone, `search` matches the user,
     * action, record or details.
     */
    /** The Audit Logs cards, across every branch and module: all actions ever recorded, and today's (pharmacy's local day) */
    public function counts(): array
    {
        $todayStart = CarbonImmutable::now(config('pharmacy.timezone'))->startOfDay()->utc();
        $today = AuditLog::where('occurred_at', '>=', $todayStart);

        return [
            'total' => AuditLog::count(),
            'since' => AuditLog::min('occurred_at') ? CarbonImmutable::parse(AuditLog::min('occurred_at'))->toIso8601String() : null,
            'today' => (clone $today)->count(),
            'todayUsers' => (clone $today)->whereNotNull('user_id')->distinct()->count('user_id'),
        ];
    }

    public function search(array $filters, int $perPage): LengthAwarePaginator
    {
        $zone = config('pharmacy.timezone');

        return AuditLog::query()
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('occurred_at', '>=', CarbonImmutable::parse($from, $zone)->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('occurred_at', '<=', CarbonImmutable::parse($to, $zone)->endOfDay()->utc()))
            ->when($filters['module'] ?? null, fn ($q, $module) => $q->where('module', $module))
            ->when($filters['branchId'] ?? null, fn ($q, $branch) => $q->where('branch_id', $branch))
            ->when($filters['search'] ?? null, function ($q, $search) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($search)).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw('lower(user_name) like ?', [$like])
                    ->orWhereRaw('lower(action) like ?', [$like])
                    ->orWhereRaw('lower(record_id) like ?', [$like])
                    ->orWhereRaw('lower(description) like ?', [$like]));
            })
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}
