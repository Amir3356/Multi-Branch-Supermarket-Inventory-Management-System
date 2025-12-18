<?php

namespace App\Features\Reports\Repositories;

use App\Features\Dashboard\Repositories\OwnerDashboardRepository;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Financial Report: profit and loss for a period, worked out exactly as the Owner's dashboard does (so the two always
 * agree), with where the money went and how it compares with the previous period of the same length.
 */
class FinancialReportRepository
{
    public function __construct(private OwnerDashboardRepository $dashboard) {}

    public function build(ReportPeriod $p): array
    {
        $now = $this->dashboard->summary($p->from, $p->to, $p->branchId);
        $t = $now['totals'];

        // The same number of days just before this period
        $days = CarbonImmutable::parse($p->from)->diffInDays(CarbonImmutable::parse($p->to)) + 1;
        $prevTo = CarbonImmutable::parse($p->from)->subDay();
        $prevFrom = $prevTo->subDays($days - 1);
        $before = $this->dashboard->summary($prevFrom->toDateString(), $prevTo->toDateString(), $p->branchId)['totals'];

        $margin = fn (float $part) => $t['sales'] > 0 ? round($part / $t['sales'] * 100, 1) : null;

        return [
            'totals' => [
                'revenue' => $t['sales'],
                'costOfSales' => $t['costOfSales'],
                'grossProfit' => $t['grossProfit'],
                'expenses' => $t['expenses'],
                'damageLoss' => $t['damageLoss'],
                'netProfit' => $t['netProfit'],
                'purchases' => $t['purchases'],
                'grossMargin' => $margin($t['grossProfit']),
                'netMargin' => $margin($t['netProfit']),
            ],
            'previous' => [
                'from' => $prevFrom->toDateString(),
                'to' => $prevTo->toDateString(),
                'revenue' => $before['sales'],
                'grossProfit' => $before['grossProfit'],
                'expenses' => $before['expenses'],
                'netProfit' => $before['netProfit'],
            ],
            'daily' => $now['daily'],
            // The branch filter doesn't apply here: every branch side by side
            'byBranch' => collect($now['branches'])
                ->when($p->branchId, fn ($c) => $c->where('id', $p->branchId))
                ->map(fn ($b) => ['branch' => $b['name'], 'revenue' => $b['sales'], 'expenses' => $b['expenses'], 'damageLoss' => $b['damageLoss'], 'netProfit' => $b['netProfit']])
                ->values()->all(),
            'expensesByCategory' => $p->dates(DB::table('expenses'), 'expense_date')
                ->selectRaw('category, sum(amount) as amount, count(*) as entries')->groupBy('category')->orderByDesc('amount')->get()
                ->map(fn ($r) => ['category' => $r->category, 'amount' => (float) $r->amount, 'entries' => (int) $r->entries])->all(),
            'damageByReason' => $p->dates(DB::table('damaged_items'), 'damage_date')
                ->selectRaw('reason, sum(loss_value) as loss, sum(qty) as units')->groupBy('reason')->orderByDesc('loss')->get()
                ->map(fn ($r) => ['reason' => $r->reason, 'loss' => (float) $r->loss, 'units' => (int) $r->units])->all(),
            'expenses' => $p->dates(DB::table('expenses'), 'expenses.expense_date', 'expenses.branch_id')
                ->leftJoin('branches', 'branches.id', '=', 'expenses.branch_id')->leftJoin('users', 'users.id', '=', 'expenses.recorded_by')
                ->orderByDesc('expense_date')->orderByDesc('expenses.id')->limit(500)
                ->get(['expenses.id', 'expenses.expense_date', 'branches.name as branch', 'expenses.category', 'expenses.description', 'expenses.amount', 'users.full_name as recorded_by'])
                ->map(fn ($r) => ['id' => $r->id, 'date' => substr((string) $r->expense_date, 0, 10), 'branch' => $r->branch, 'category' => $r->category, 'description' => $r->description, 'amount' => (float) $r->amount, 'recordedBy' => $r->recorded_by])->all(),
        ];
    }
}
