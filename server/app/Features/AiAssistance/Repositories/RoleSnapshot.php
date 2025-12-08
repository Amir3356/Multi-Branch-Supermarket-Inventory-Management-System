<?php

namespace App\Features\AiAssistance\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Dashboard\Repositories\OwnerDashboardRepository;
use App\Features\Policies\Repositories\PolicyRepository;
use App\Features\Stock\Models\StockBatch;
use App\Shared\Enums\Role;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The figures one role's AI Assistance works from: only what that role may see in the app, and only its own branch
 * for branch staff. No customer or staff names are included, since this is sent to an outside AI service.
 */
class RoleSnapshot
{
    private const DAYS = 30;

    private const LIST_LIMIT = 15;

    private CarbonImmutable $today;

    private int $minStock;

    private int $warningDays;

    /** @var Collection<string, object> branch id => {id, name, status} */
    private Collection $branches;

    /** @var array<string, float> lower-case product name => purchase price */
    private array $costs;

    /** Every branch's stock, one entry per product at a branch (see stockByProduct) */
    private Collection $stock;

    public function __construct(
        private PolicyRepository $policies,
        private OwnerDashboardRepository $ownerDashboard,
    ) {}

    public function for(User $user): array
    {
        $this->today = CarbonImmutable::now(config('pharmacy.timezone'))->startOfDay();
        $policy = $this->policies->current();
        $this->minStock = $policy->default_min_stock;
        $this->warningDays = $policy->expiry_warning_days;
        $this->branches = DB::table('branches')->orderBy('name')->get(['id', 'name', 'status'])->keyBy('id');
        $this->costs = DB::table('products')->whereNotNull('purchase_price')->pluck('purchase_price', 'name')
            ->mapWithKeys(fn ($price, $name) => [mb_strtolower(trim($name)) => (float) $price])->all();

        $this->stock = $this->stockByProduct();

        $branchId = $user->coversAllBranches() ? null : $user->branch_id;

        $context = [
            'role' => $user->role->label(),
            'scope' => $branchId ? 'Branch '.$this->branchName($branchId) : 'All branches',
            'today' => $this->today->toDateString(),
            'currency' => 'ETB',
            'policy' => ['minimumStockUnits' => $this->minStock, 'expiryWarningDays' => $this->warningDays],
            'recentPeriod' => 'last '.self::DAYS.' days',
        ];

        return $context + match ($user->role) {
            Role::Owner => $this->owner(),
            Role::Pharmacist => $this->pharmacist($branchId),
            Role::Cashier => $this->cashier($branchId),
            Role::PurchaseOfficer => $this->procurementOfficer(),
        };
    }

    // ---- Roles ----

    private function owner(): array
    {
        [$from, $to] = [$this->today->subDays(self::DAYS - 1)->toDateString(), $this->today->toDateString()];
        [$prevFrom, $prevTo] = [$this->today->subDays(2 * self::DAYS - 1)->toDateString(), $this->today->subDays(self::DAYS)->toDateString()];
        $now = $this->ownerDashboard->summary($from, $to, null);
        $before = $this->ownerDashboard->summary($prevFrom, $prevTo, null)['totals'];
        $stock = $this->stock;

        return [
            'totals' => $now['totals'],
            'previousPeriodTotals' => array_intersect_key($before, array_flip(['sales', 'purchases', 'expenses', 'damageLoss', 'grossProfit', 'netProfit'])),
            'branches' => array_map(fn ($b) => array_diff_key($b, ['id' => 1]) + $this->stockHealth($stock->where('branchId', $b['id'])), $now['branches']),
            'topProducts' => array_slice($now['topProducts'], 0, 10),
            'stockAtRisk' => $this->stockAtRisk(),
            'staffAndPayments' => $now['now'],
            'expensesByCategory' => $this->expensesByCategory(null),
            'damageByReason' => $this->damageByReason(null),
        ];
    }

    private function pharmacist(string $branchId): array
    {
        $stock = $this->stock->where('branchId', $branchId);
        $velocity = $this->velocity($branchId);

        return [
            'stockHealth' => $this->stockHealth($stock),
            'outOfStock' => $this->outOfStock($stock, $velocity),
            'lowStock' => $this->lowStock($stock, $velocity),
            'expiredBatches' => $this->expiryList($stock, expired: true),
            'expiringSoonBatches' => $this->expiryList($stock, expired: false),
            'slowMovers' => $this->slowMovers($stock, $velocity),
            'transferOptions' => $this->transferOptions($branchId, $stock),
            'transfersInTransit' => [
                'incoming' => $this->transfersInTransit('to_branch_id', $branchId),
                'outgoing' => $this->transfersInTransit('from_branch_id', $branchId),
            ],
            'paidOrdersAwaitingReceiving' => DB::table('procurements')->where('branch_id', $branchId)->where('status', 'paid')->whereNull('received_at')
                ->orderBy('paid_at')->limit(self::LIST_LIMIT)->get(['product', 'qty', 'paid_at'])
                ->map(fn ($p) => ['product' => $p->product, 'qty' => (int) $p->qty, 'paidOn' => substr((string) $p->paid_at, 0, 10)])->all(),
            'damageByReason' => $this->damageByReason($branchId),
            'expensesByCategory' => $this->expensesByCategory($branchId),
        ];
    }

    private function cashier(string $branchId): array
    {
        $sales = fn () => DB::table('sales')->where('branch_id', $branchId);
        $since = fn (CarbonImmutable $day) => $day->utc();
        $stock = $this->stock->where('branchId', $branchId);
        $velocity = $this->velocity($branchId);
        $zone = config('pharmacy.timezone');
        $total = fn ($q) => ['amount' => (float) (clone $q)->sum('total'), 'count' => (clone $q)->count(), 'units' => (int) (clone $q)->sum('qty')];

        return [
            'sales' => [
                'today' => $total($sales()->where('created_at', '>=', $since($this->today))),
                'yesterday' => $total($sales()->whereBetween('created_at', [$since($this->today->subDay()), $since($this->today)])),
                'last7Days' => $total($sales()->where('created_at', '>=', $since($this->today->subDays(6)))),
                'previous7Days' => $total($sales()->whereBetween('created_at', [$since($this->today->subDays(13)), $since($this->today->subDays(6))])),
            ],
            'salesByHour' => $sales()->where('created_at', '>=', $since($this->today->subDays(self::DAYS - 1)))
                ->selectRaw("extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE ?)::int as hour, count(*) as count, sum(total) as amount", [$zone])
                ->groupBy('hour')->orderBy('hour')->get()
                ->map(fn ($h) => ['hour' => (int) $h->hour, 'count' => (int) $h->count, 'amount' => (float) $h->amount])->all(),
            'topProducts' => collect($velocity)->sortByDesc('revenue')->take(10)
                ->map(fn ($v, $name) => ['product' => $v['product'], 'units' => $v['units'], 'revenue' => $v['revenue']])->values()->all(),
            'outOfStockButInDemand' => array_values(array_filter($this->outOfStock($stock, $velocity), fn ($p) => $p['unitsSoldRecently'] > 0)),
            'lowStockBestSellers' => array_values(array_filter($this->lowStock($stock, $velocity), fn ($p) => $p['avgDailySales'] > 0)),
            'expiringSoonInStock' => $this->expiryList($stock, expired: false),
            'expiredStillOnShelf' => $this->expiryList($stock, expired: true),
        ];
    }

    private function procurementOfficer(): array
    {
        $stock = $this->stock;
        $reorder = [];
        foreach ($this->branches as $branch) {
            $velocity = $this->velocity($branch->id);
            $here = $stock->where('branchId', $branch->id);
            foreach (array_merge($this->outOfStock($here, $velocity), $this->lowStock($here, $velocity)) as $item) {
                $monthNeed = (int) ceil($item['avgDailySales'] * self::DAYS);
                $reorder[] = ['branch' => $branch->name] + $item + [
                    'onOrder' => $this->onOrder($branch->id, $item['product']),
                    'suggestedQty' => max(0, max($this->minStock * 2, $monthNeed) - ($item['stock'] ?? 0)),
                    'availableAtOtherBranches' => $this->surplusElsewhere($branch->id, $item['product'], $stock),
                ];
            }
        }
        usort($reorder, fn ($a, $b) => $b['avgDailySales'] <=> $a['avgDailySales']);

        $since = $this->today->subDays(180)->utc();
        $recent = $this->today->subDays(self::DAYS - 1)->utc();

        return [
            'reorderCandidates' => array_slice($reorder, 0, 25),
            'ordersAwaitingPayment' => DB::table('procurements')->whereIn('status', ['pending', 'failed'])->orderByDesc('created_at')->limit(self::LIST_LIMIT)
                ->get(['branch_id', 'supplier', 'product', 'qty', 'total', 'status', 'created_at'])
                ->map(fn ($p) => ['branch' => $this->branchName($p->branch_id), 'supplier' => $p->supplier, 'product' => $p->product, 'qty' => (int) $p->qty, 'total' => (float) $p->total, 'status' => $p->status, 'orderedOn' => substr((string) $p->created_at, 0, 10)])->all(),
            'paidNotYetReceived' => DB::table('procurements')->where('status', 'paid')->whereNull('received_at')->orderBy('paid_at')->limit(self::LIST_LIMIT)
                ->get(['branch_id', 'supplier', 'product', 'qty', 'paid_at'])
                ->map(fn ($p) => ['branch' => $this->branchName($p->branch_id), 'supplier' => $p->supplier, 'product' => $p->product, 'qty' => (int) $p->qty, 'paidOn' => substr((string) $p->paid_at, 0, 10)])->all(),
            'supplierPrices' => DB::table('procurements')->where('status', 'paid')->where('created_at', '>=', $since)
                ->selectRaw('product, supplier, round(avg(unit_price), 2) as avg_price, min(unit_price) as best_price, count(*) as orders, max(created_at) as last_order')
                ->groupBy('product', 'supplier')->orderBy('product')->limit(40)->get()
                ->map(fn ($r) => ['product' => $r->product, 'supplier' => $r->supplier, 'avgUnitPrice' => (float) $r->avg_price, 'bestUnitPrice' => (float) $r->best_price, 'orders' => (int) $r->orders, 'lastOrder' => substr((string) $r->last_order, 0, 10)])->all(),
            'spendLast30Days' => [
                'paid' => (float) DB::table('procurements')->where('status', 'paid')->where('created_at', '>=', $recent)->sum('total'),
                'orders' => DB::table('procurements')->where('status', 'paid')->where('created_at', '>=', $recent)->count(),
            ],
            'stockHealthByBranch' => $this->branches->map(fn ($b) => ['branch' => $b->name] + $this->stockHealth($stock->where('branchId', $b->id)))->values()->all(),
        ];
    }

    // ---- Stock ----

    /** One entry per product at a branch: total units (empty batches count as 0) and its batches */
    private function stockByProduct(): Collection
    {
        return StockBatch::all()
            ->map(fn (StockBatch $b) => ['branchId' => $b->branch_id, 'product' => $b->product, 'category' => $b->category, 'batch' => $b->batch, 'expiry' => $b->expiry_date?->toDateString(), 'stock' => $b->units])
            ->groupBy(fn ($b) => $b['branchId'].'|'.mb_strtolower(trim($b['product'])))
            ->map(fn (Collection $batches) => [
                'branchId' => $batches->first()['branchId'],
                'product' => $batches->first()['product'],
                'category' => $batches->first()['category'],
                'stock' => $batches->sum(fn ($b) => max(0, $b['stock'])),
                'batches' => $batches->filter(fn ($b) => $b['stock'] > 0)->values()->all(),
            ])
            ->values();
    }

    private function stockHealth(Collection $stock): array
    {
        $expiredValue = 0;
        $expiringValue = 0;
        $expired = $expiring = 0;
        foreach ($stock as $p) {
            foreach ($p['batches'] as $b) {
                $days = $this->daysLeft($b['expiry']);
                if ($days === null) {
                    continue;
                }
                if ($days < 0) {
                    $expired++;
                    $expiredValue += $b['stock'] * $this->cost($p['product']);
                } elseif ($days <= $this->warningDays) {
                    $expiring++;
                    $expiringValue += $b['stock'] * $this->cost($p['product']);
                }
            }
        }

        return [
            'productsInStock' => $stock->where('stock', '>', 0)->count(),
            'lowStockProducts' => $stock->filter(fn ($p) => $p['stock'] > 0 && $p['stock'] < $this->minStock)->count(),
            'outOfStockProducts' => $stock->where('stock', '<=', 0)->count(),
            'expiredBatches' => $expired,
            'expiredValueAtCost' => round($expiredValue, 2),
            'expiringSoonBatches' => $expiring,
            'expiringSoonValueAtCost' => round($expiringValue, 2),
            'stockValueAtCost' => round($stock->sum(fn ($p) => $p['stock'] * $this->cost($p['product'])), 2),
        ];
    }

    private function outOfStock(Collection $stock, array $velocity): array
    {
        return $stock->filter(fn ($p) => $p['stock'] <= 0)
            ->map(fn ($p) => ['product' => $p['product'], 'category' => $p['category'], 'stock' => 0] + $this->demand($p['product'], $velocity))
            ->sortByDesc('unitsSoldRecently')->take(self::LIST_LIMIT)->values()->all();
    }

    private function lowStock(Collection $stock, array $velocity): array
    {
        return $stock->filter(fn ($p) => $p['stock'] > 0 && $p['stock'] < $this->minStock)
            ->map(function ($p) use ($velocity) {
                $demand = $this->demand($p['product'], $velocity);

                return ['product' => $p['product'], 'category' => $p['category'], 'stock' => $p['stock']] + $demand
                    + ['daysOfCover' => $demand['avgDailySales'] > 0 ? round($p['stock'] / $demand['avgDailySales'], 1) : null];
            })
            ->sortBy(fn ($p) => $p['daysOfCover'] ?? PHP_INT_MAX)->take(self::LIST_LIMIT)->values()->all();
    }

    /** Batches past their date (expired) or inside the warning window, soonest first, with what they cost */
    private function expiryList(Collection $stock, bool $expired): array
    {
        $list = [];
        foreach ($stock as $p) {
            foreach ($p['batches'] as $b) {
                $days = $this->daysLeft($b['expiry']);
                if ($days === null || ($expired ? $days >= 0 : ($days < 0 || $days > $this->warningDays))) {
                    continue;
                }
                $list[] = ['product' => $p['product'], 'batch' => $b['batch'], 'expiry' => $b['expiry'], 'daysLeft' => $days, 'units' => $b['stock'], 'valueAtCost' => round($b['stock'] * $this->cost($p['product']), 2)];
            }
        }
        usort($list, fn ($a, $b) => $a['daysLeft'] <=> $b['daysLeft']);

        return array_slice($list, 0, self::LIST_LIMIT);
    }

    /** Expired and expiring batches at every branch, with the branch named, soonest first */
    private function stockAtRisk(): array
    {
        $list = [];
        foreach ($this->branches as $branch) {
            $here = $this->stock->where('branchId', $branch->id);
            foreach ([...$this->expiryList($here, expired: true), ...$this->expiryList($here, expired: false)] as $batch) {
                $list[] = ['branch' => $branch->name] + $batch;
            }
        }
        usort($list, fn ($a, $b) => $a['daysLeft'] <=> $b['daysLeft']);

        return array_slice($list, 0, self::LIST_LIMIT);
    }

    /** In stock but nothing sold in the recent period: money sitting on the shelf */
    private function slowMovers(Collection $stock, array $velocity): array
    {
        return $stock->filter(fn ($p) => $p['stock'] > 0 && ! isset($velocity[mb_strtolower(trim($p['product']))]))
            ->map(fn ($p) => ['product' => $p['product'], 'stock' => $p['stock'], 'valueAtCost' => round($p['stock'] * $this->cost($p['product']), 2)])
            ->sortByDesc('valueAtCost')->take(10)->values()->all();
    }

    /** Products low or out here that another branch holds comfortably above the minimum */
    private function transferOptions(string $branchId, Collection $stock): array
    {
        $options = [];
        foreach ($stock->filter(fn ($p) => $p['stock'] < $this->minStock) as $p) {
            if ($elsewhere = $this->surplusElsewhere($branchId, $p['product'], $this->stock)) {
                $options[] = ['product' => $p['product'], 'stockHere' => $p['stock'], 'availableAt' => $elsewhere];
            }
        }

        return array_slice($options, 0, self::LIST_LIMIT);
    }

    private function surplusElsewhere(string $branchId, string $product, Collection $stock): array
    {
        return $stock->filter(fn ($p) => $p['branchId'] !== $branchId && $this->same($p['product'], $product) && $p['stock'] > $this->minStock * 1.5)
            ->map(fn ($p) => ['branch' => $this->branchName($p['branchId']), 'stock' => $p['stock'], 'canSpare' => $p['stock'] - $this->minStock])
            ->values()->all();
    }

    private function onOrder(string $branchId, string $product): int
    {
        return (int) DB::table('procurements')->where('branch_id', $branchId)->whereRaw('lower(product) = ?', [mb_strtolower(trim($product))])
            ->where(fn ($q) => $q->where('status', 'pending')->orWhere(fn ($w) => $w->where('status', 'paid')->whereNull('received_at')))
            ->sum('qty');
    }

    private function transfersInTransit(string $column, string $branchId): array
    {
        return DB::table('stock_transfers')->where($column, $branchId)->where('status', 'in_transit')->orderBy('created_at')->limit(self::LIST_LIMIT)
            ->get(['from_branch_id', 'to_branch_id', 'product', 'qty', 'created_at'])
            ->map(fn ($t) => ['product' => $t->product, 'qty' => (int) $t->qty, 'from' => $this->branchName($t->from_branch_id), 'to' => $this->branchName($t->to_branch_id), 'sentOn' => substr((string) $t->created_at, 0, 10)])->all();
    }

    // ---- Sales, damage, expenses ----

    /** Units and revenue per product at a branch over the recent period, keyed by lower-case name */
    private function velocity(string $branchId): array
    {
        return DB::table('sales')->where('branch_id', $branchId)->where('created_at', '>=', $this->today->subDays(self::DAYS - 1)->utc())
            ->selectRaw('lower(trim(product)) as key, max(product) as product, sum(qty) as units, sum(total) as revenue')
            ->groupBy('key')->get()
            ->mapWithKeys(fn ($r) => [$r->key => ['product' => $r->product, 'units' => (int) $r->units, 'revenue' => (float) $r->revenue]])->all();
    }

    private function demand(string $product, array $velocity): array
    {
        $units = $velocity[mb_strtolower(trim($product))]['units'] ?? 0;

        return ['unitsSoldRecently' => $units, 'avgDailySales' => round($units / self::DAYS, 2)];
    }

    private function damageByReason(?string $branchId): array
    {
        return DB::table('damaged_items')->where('damage_date', '>=', $this->today->subDays(self::DAYS - 1)->toDateString())
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->selectRaw('reason, sum(qty) as units, sum(loss_value) as loss, count(*) as records')
            ->groupBy('reason')->orderByDesc('loss')->get()
            ->map(fn ($r) => ['reason' => $r->reason, 'units' => (int) $r->units, 'loss' => (float) $r->loss, 'records' => (int) $r->records])->all();
    }

    private function expensesByCategory(?string $branchId): array
    {
        return DB::table('expenses')->where('expense_date', '>=', $this->today->subDays(self::DAYS - 1)->toDateString())
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->selectRaw('category, sum(amount) as amount, count(*) as records')
            ->groupBy('category')->orderByDesc('amount')->get()
            ->map(fn ($r) => ['category' => $r->category, 'amount' => (float) $r->amount, 'records' => (int) $r->records])->all();
    }

    // ---- Helpers ----

    /** Calendar days from today to an expiry date: 0 today, negative once past; null when there's no date */
    private function daysLeft(?string $expiry): ?int
    {
        return $expiry ? (int) $this->today->diffInDays(CarbonImmutable::parse($expiry, config('pharmacy.timezone'))->startOfDay(), false) : null;
    }

    private function cost(string $product): float
    {
        return $this->costs[mb_strtolower(trim($product))] ?? 0;
    }

    private function branchName(?string $id): string
    {
        return $this->branches[$id]->name ?? (string) $id;
    }

    private function same(string $a, string $b): bool
    {
        return mb_strtolower(trim($a)) === mb_strtolower(trim($b));
    }
}
