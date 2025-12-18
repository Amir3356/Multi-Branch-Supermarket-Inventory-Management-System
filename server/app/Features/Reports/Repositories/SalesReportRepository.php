<?php

namespace App\Features\Reports\Repositories;

use App\Features\Dashboard\Repositories\OwnerDashboardRepository;
use Illuminate\Support\Facades\DB;

/** Sales Report: what was sold in a period, where, by whom, and which products earn the most */
class SalesReportRepository
{
    private const TOP = 15;

    public function build(ReportPeriod $p): array
    {
        $sales = fn () => $p->timestamps(DB::table('sales'), 'sales.created_at', 'sales.branch_id');
        $revenue = (float) $sales()->sum('total');
        $count = $sales()->count();
        // Cost of what was sold: units × the product's purchase price, found as the Owner's dashboard finds it
        $cost = (float) OwnerDashboardRepository::withProduct($sales())->sum(DB::raw('sales.qty * coalesce(products.purchase_price, 0)'));

        return [
            'totals' => [
                'revenue' => $revenue,
                'transactions' => $count,
                'units' => (int) $sales()->sum('qty'),
                'averageSale' => $count ? round($revenue / $count, 2) : 0,
                'costOfSales' => $cost,
                'grossProfit' => $revenue - $cost,
            ],
            'daily' => $sales()->selectRaw($p->localDay('sales.created_at').' as day, sum(total) as revenue, count(*) as transactions')
                ->groupBy('day')->orderBy('day')->get()
                ->map(fn ($r) => ['date' => $r->day, 'revenue' => (float) $r->revenue, 'transactions' => (int) $r->transactions])->all(),
            'byBranch' => $sales()->join('branches', 'branches.id', '=', 'sales.branch_id')
                ->selectRaw('branches.name as branch, sum(total) as revenue, count(*) as transactions, sum(qty) as units')
                ->groupBy('branches.name')->orderByDesc('revenue')->get()
                ->map(fn ($r) => ['branch' => $r->branch, 'revenue' => (float) $r->revenue, 'transactions' => (int) $r->transactions, 'units' => (int) $r->units])->all(),
            'byCategory' => $sales()->selectRaw('category, sum(total) as revenue, sum(qty) as units')
                ->groupBy('category')->orderByDesc('revenue')->get()
                ->map(fn ($r) => ['category' => $r->category, 'revenue' => (float) $r->revenue, 'units' => (int) $r->units])->all(),
            'topProducts' => $sales()->selectRaw('product, max(category) as category, sum(qty) as units, sum(total) as revenue, count(*) as transactions')
                ->groupBy('product')->orderByDesc('revenue')->limit(self::TOP)->get()
                ->map(fn ($r) => ['product' => $r->product, 'category' => $r->category, 'units' => (int) $r->units, 'revenue' => (float) $r->revenue, 'transactions' => (int) $r->transactions])->all(),
            'byCashier' => $sales()->leftJoin('users', 'users.id', '=', 'sales.sold_by')->leftJoin('branches', 'branches.id', '=', 'sales.branch_id')
                ->selectRaw("coalesce(users.full_name, 'Former staff') as cashier, max(branches.name) as branch, count(*) as transactions, sum(sales.total) as revenue, sum(sales.qty) as units")
                ->groupBy('cashier')->orderByDesc('revenue')->get()
                ->map(fn ($r) => ['cashier' => $r->cashier, 'branch' => $r->branch, 'transactions' => (int) $r->transactions, 'revenue' => (float) $r->revenue, 'units' => (int) $r->units])->all(),
            'rows' => $sales()->leftJoin('users', 'users.id', '=', 'sales.sold_by')->leftJoin('branches', 'branches.id', '=', 'sales.branch_id')
                ->orderByDesc('sales.created_at')->limit(1000)
                ->get(['sales.id', 'sales.created_at', 'branches.name as branch', 'users.full_name as cashier', 'sales.customer', 'sales.product', 'sales.category', 'sales.qty', 'sales.unit_price', 'sales.total'])
                ->map(fn ($r) => [
                    'id' => $r->id, 'at' => $p->local($r->created_at), 'branch' => $r->branch, 'cashier' => $r->cashier ?? 'Former staff',
                    'customer' => $r->customer, 'product' => $r->product, 'category' => $r->category, 'qty' => (int) $r->qty,
                    'unitPrice' => (float) $r->unit_price, 'total' => (float) $r->total,
                ])->all(),
            'rowsTotal' => $count,
        ];
    }
}
