<?php

namespace App\Features\Dashboard\Repositories;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * The Owner's dashboard figures, worked out in the database for a period (calendar days in the pharmacy's time zone)
 * and optionally one branch. Sales count by when they were made, purchases by order date (paid orders only, as on the
 * Procurement Officer's dashboard), expenses by their expense date, damaged stock by the day it was written off.
 */
class OwnerDashboardRepository
{
    private string $zone;

    private CarbonImmutable $start;

    private CarbonImmutable $end;

    public function __construct()
    {
        $this->zone = config('pharmacy.timezone');
    }

    public function summary(string $from, string $to, ?string $branchId): array
    {
        // Timestamps are stored in UTC; the period's days are the pharmacy's
        $this->start = CarbonImmutable::parse($from, $this->zone)->startOfDay()->utc();
        $this->end = CarbonImmutable::parse($to, $this->zone)->endOfDay()->utc();
        $sales = fn () => $this->inPeriod(DB::table('sales'), 'sales.created_at')->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId));
        $purchases = fn () => $this->inPeriod(DB::table('procurements'), 'created_at')->where('status', 'paid')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $expenses = fn () => DB::table('expenses')->whereBetween('expense_date', [$from, $to])->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $damaged = fn () => DB::table('damaged_items')->whereBetween('damage_date', [$from, $to])->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        // Cost of what was sold: units × the product's purchase price (its latest, the one Add Medicine recorded)
        $costOfSales = (float) self::withProduct($sales())->sum(DB::raw('sales.qty * coalesce(products.purchase_price, 0)'));
        $salesTotal = (float) $sales()->sum('total');
        $expensesTotal = (float) $expenses()->sum('amount');
        // What written-off stock cost to buy: it was paid for and can't be sold
        $damageLoss = (float) $damaged()->sum('loss_value');

        return [
            'totals' => [
                'sales' => $salesTotal,
                'salesCount' => $sales()->count(),
                'unitsSold' => (int) $sales()->sum('qty'),
                'purchases' => (float) $purchases()->sum('total'),
                'purchasesCount' => $purchases()->count(),
                'expenses' => $expensesTotal,
                'expensesCount' => $expenses()->count(),
                'damageLoss' => $damageLoss,
                'damagedUnits' => (int) $damaged()->sum('qty'),
                'costOfSales' => $costOfSales,
                'grossProfit' => $salesTotal - $costOfSales,
                'netProfit' => $salesTotal - $costOfSales - $expensesTotal - $damageLoss,
            ],
            'now' => $this->rightNow($branchId),
            'daily' => $this->daily($sales(), $purchases(), $expenses()),
            'branches' => $this->byBranch($from, $to),
            'topProducts' => $sales()->selectRaw('product, sum(total) as total, sum(qty) as qty')
                ->groupBy('product')->orderByDesc('total')->limit(20)->get()
                ->map(fn ($r) => ['product' => $r->product, 'total' => (float) $r->total, 'qty' => (int) $r->qty])->all(),
        ];
    }

    /**
     * Sales joined to their catalog product, for its purchase price: by the sale's product id when the catalog has it,
     * otherwise by name and category (a sale without an id, or with one only a browser knew, still finds its cost).
     */
    public static function withProduct(Builder $sales): Builder
    {
        return $sales->leftJoin('products', fn ($j) => $j->on('products.id', '=', 'sales.med_id')->orWhere(fn ($w) => $w
            ->whereRaw('lower(products.name) = lower(sales.product)')
            ->whereColumn('products.category', 'sales.category')
            ->whereRaw('not exists (select 1 from products known where known.id = sales.med_id)')));
    }

    private function inPeriod(Builder $query, string $column): Builder
    {
        return $query->whereBetween($column, [$this->start, $this->end]);
    }

    // The pharmacy's calendar day of a UTC timestamp column, as YYYY-MM-DD
    private function localDay(string $column): string
    {
        return "to_char(({$column} AT TIME ZONE 'UTC') AT TIME ZONE '{$this->zone}', 'YYYY-MM-DD')";
    }

    /** Sales, purchases and expenses per day of the period that had any */
    private function daily(Builder $sales, Builder $purchases, Builder $expenses): array
    {
        $days = [];
        foreach ($sales->selectRaw($this->localDay('created_at').' as day, sum(total) as amount')->groupBy('day')->get() as $r) {
            $days[$r->day]['sales'] = (float) $r->amount;
        }
        foreach ($purchases->selectRaw($this->localDay('created_at').' as day, sum(total) as amount')->groupBy('day')->get() as $r) {
            $days[$r->day]['purchases'] = (float) $r->amount;
        }
        foreach ($expenses->selectRaw("to_char(expense_date, 'YYYY-MM-DD') as day, sum(amount) as amount")->groupBy('day')->get() as $r) {
            $days[$r->day]['expenses'] = (float) $r->amount;
        }
        ksort($days);

        return collect($days)->map(fn ($d, $day) => ['date' => $day, 'sales' => $d['sales'] ?? 0, 'purchases' => $d['purchases'] ?? 0, 'expenses' => $d['expenses'] ?? 0])->values()->all();
    }

    /** Every branch's figures for the period, side by side (the branch filter doesn't apply here) */
    private function byBranch(string $from, string $to): array
    {
        $sales = self::withProduct($this->inPeriod(DB::table('sales'), 'sales.created_at'))
            ->selectRaw('sales.branch_id, sum(sales.total) as total, count(*) as count, sum(sales.qty * coalesce(products.purchase_price, 0)) as cost')
            ->groupBy('sales.branch_id')->get()->keyBy('branch_id');
        $purchases = $this->inPeriod(DB::table('procurements'), 'created_at')->where('status', 'paid')
            ->selectRaw('branch_id, sum(total) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $expenses = DB::table('expenses')->whereBetween('expense_date', [$from, $to])
            ->selectRaw('branch_id, sum(amount) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $damaged = DB::table('damaged_items')->whereBetween('damage_date', [$from, $to])
            ->selectRaw('branch_id, sum(loss_value) as total')->groupBy('branch_id')->pluck('total', 'branch_id');

        return DB::table('branches')->orderBy('name')->get(['id', 'name', 'status'])->map(function ($b) use ($sales, $purchases, $expenses, $damaged) {
            $sold = (float) ($sales[$b->id]->total ?? 0);
            $cost = (float) ($sales[$b->id]->cost ?? 0);
            $spent = (float) ($expenses[$b->id] ?? 0);
            $lost = (float) ($damaged[$b->id] ?? 0);

            return [
                'id' => $b->id,
                'name' => $b->name,
                'status' => ucfirst($b->status),
                'sales' => $sold,
                'salesCount' => (int) ($sales[$b->id]->count ?? 0),
                'purchases' => (float) ($purchases[$b->id] ?? 0),
                'expenses' => $spent,
                'damageLoss' => $lost,
                'netProfit' => $sold - $cost - $spent - $lost,
            ];
        })->all();
    }

    /** Figures that don't depend on the period */
    private function rightNow(?string $branchId): array
    {
        $pending = DB::table('procurements')->where('status', 'pending')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        return [
            'activeBranches' => DB::table('branches')->where('status', 'active')->count(),
            'totalBranches' => DB::table('branches')->count(),
            'activeStaff' => DB::table('users')->where('role', '!=', 'owner')->where('status', 'active')->when($branchId, fn ($q) => $q->where(fn ($w) => $w->where('branch_id', $branchId)->orWhereNull('branch_id')))->count(),
            'invitedStaff' => DB::table('users')->where('status', 'invited')->when($branchId, fn ($q) => $q->where('branch_id', $branchId))->count(),
            'awaitingPayment' => (clone $pending)->count(),
            'awaitingPaymentAmount' => (float) (clone $pending)->sum('total'),
        ];
    }
}
