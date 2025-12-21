<?php

namespace App\Features\Reports\Repositories;

use App\Features\AccessReviews\Services\AccessReviewGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * User Report: every account as it stood at the end of the period (role, branch, status, last sign-in), with dormant
 * accounts, role changes and expired invitation links flagged. Worked out like a saved access review, but live: nothing
 * is stored. With a branch chosen, only that branch's staff (those covering every branch are left out).
 */
class UserReportRepository
{
    public function __construct(private AccessReviewGenerator $generator) {}

    public function build(ReportPeriod $p): array
    {
        $report = $this->generator->compute(
            CarbonImmutable::parse($p->from, $p->zone)->startOfDay(),
            CarbonImmutable::parse($p->to, $p->zone)->endOfDay(),
        );
        $branchName = $p->branchId ? DB::table('branches')->where('id', $p->branchId)->value('name') : null;
        $rows = collect($report['rows'])->when($branchName, fn ($rows) => $rows->where('branchName', $branchName))->values();
        $flagged = fn (string $flag) => $rows->filter(fn ($r) => in_array($flag, $r['flags'], true))->count();

        return [
            'asOf' => $report['summary']['asOf'],
            'dormantDays' => $report['summary']['dormantDays'],
            'totals' => [
                'users' => $rows->count(),
                'active' => $rows->where('status', 'Active')->count(),
                'pending' => $rows->where('status', 'Pending')->count(),
                'inactive' => $rows->where('status', 'Inactive')->count(),
                'dormant' => $flagged('dormant'),
                'roleChanged' => $flagged('role_changed'),
                'invitationExpired' => $flagged('stale_invitation'),
            ],
            'rows' => $rows->all(),
        ];
    }
}
