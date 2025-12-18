<?php

namespace App\Features\Reports\Repositories;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;

/**
 * A report's period (calendar days in the pharmacy's time zone) and optional branch. Timestamps are stored in UTC, so a
 * period's days become a UTC range; date columns (expense dates, damage dates) compare by date.
 */
class ReportPeriod
{
    public readonly string $zone;

    public readonly CarbonImmutable $start;

    public readonly CarbonImmutable $end;

    public function __construct(public readonly string $from, public readonly string $to, public readonly ?string $branchId)
    {
        $this->zone = config('pharmacy.timezone');
        $this->start = CarbonImmutable::parse($from, $this->zone)->startOfDay()->utc();
        $this->end = CarbonImmutable::parse($to, $this->zone)->endOfDay()->utc();
    }

    /** Rows whose timestamp column falls in the period, and in the branch when one is chosen */
    public function timestamps(Builder $query, string $column, ?string $branchColumn = 'branch_id'): Builder
    {
        return $query->whereBetween($column, [$this->start, $this->end])
            ->when($this->branchId && $branchColumn, fn ($q) => $q->where($branchColumn, $this->branchId));
    }

    /** Rows whose date column falls in the period, and in the branch when one is chosen */
    public function dates(Builder $query, string $column, ?string $branchColumn = 'branch_id'): Builder
    {
        return $query->whereBetween($column, [$this->from, $this->to])
            ->when($this->branchId && $branchColumn, fn ($q) => $q->where($branchColumn, $this->branchId));
    }

    /** The pharmacy's calendar day of a UTC timestamp column, as YYYY-MM-DD */
    public function localDay(string $column): string
    {
        return "to_char(({$column} AT TIME ZONE 'UTC') AT TIME ZONE '{$this->zone}', 'YYYY-MM-DD')";
    }

    /** A UTC timestamp as the pharmacy's local time, ISO 8601 */
    public function local(?string $timestamp): ?string
    {
        return $timestamp ? CarbonImmutable::parse($timestamp, 'UTC')->setTimezone($this->zone)->toIso8601String() : null;
    }
}
