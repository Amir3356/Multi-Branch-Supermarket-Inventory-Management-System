<?php

namespace App\Features\Reports\Repositories;

use App\Features\Policies\Repositories\PolicyRepository;
use App\Features\Stock\Models\StockBatch;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Inventory Report: each branch's stock right now (from stock_batches, the same figures the Inventory page shows) with
 * its value and problems (low, out, expiring, expired), and how stock moved during the period.
 */
class InventoryReportRepository
{
    public function __construct(private PolicyRepository $policies) {}

    public function build(ReportPeriod $p): array
    {
        $policy = $this->policies->current();
        $minStock = $policy->default_min_stock;
        $today = CarbonImmutable::now($p->zone)->toDateString();
        $soon = CarbonImmutable::now($p->zone)->addDays($policy->expiry_warning_days)->toDateString();
        $branches = DB::table('branches')->pluck('name', 'id');
        $prices = $this->prices();

        $batches = StockBatch::query()->when($p->branchId, fn ($q) => $q->where('branch_id', $p->branchId))->get();
        $price = fn (StockBatch $b, string $kind) => $prices[$b->med_id ? "id:{$b->med_id}" : ''][$kind] ?? $prices["name:{$b->product_key}"][$kind] ?? 0.0;

        // Product totals at each branch decide Low / Out of Stock, like the Inventory page
        $products = $batches->groupBy(fn ($b) => $b->branch_id.'|'.$b->product_key)->map(fn (Collection $group) => [
            'branchId' => $group->first()->branch_id,
            'product' => $group->first()->product,
            'category' => $group->first()->category,
            'units' => $group->sum('units'),
        ]);
        $productStatus = $products->mapWithKeys(fn ($pr, $key) => [$key => $pr['units'] <= 0 ? 'Out of Stock' : ($pr['units'] < $minStock ? 'Low Stock' : 'In Stock')]);

        $rows = $batches->filter(fn ($b) => $b->units > 0)->map(function (StockBatch $b) use ($branches, $price, $productStatus, $today, $soon) {
            $expiry = $b->expiry_date?->toDateString();
            $status = $expiry && $expiry < $today ? 'Expired' : ($expiry && $expiry <= $soon ? 'Expiring Soon' : $productStatus["{$b->branch_id}|{$b->product_key}"]);

            return [
                'branch' => $branches[$b->branch_id] ?? $b->branch_id,
                'branchId' => $b->branch_id,
                'product' => $b->product,
                'category' => $b->category,
                'batch' => $b->batch,
                'expiry' => $expiry,
                'units' => $b->units,
                'unitCost' => $price($b, 'cost'),
                'valueAtCost' => round($b->units * $price($b, 'cost'), 2),
                'valueAtSelling' => round($b->units * $price($b, 'selling'), 2),
                'status' => $status,
            ];
        })->sortBy([['branch', 'asc'], ['product', 'asc'], ['expiry', 'asc']])->values();

        $outOfStock = $products->filter(fn ($pr) => $pr['units'] <= 0)
            ->map(fn ($pr) => ['branch' => $branches[$pr['branchId']] ?? $pr['branchId'], 'product' => $pr['product'], 'category' => $pr['category']])
            ->sortBy('product')->values()->all();
        $count = fn (string $status) => $rows->where('status', $status)->count();

        return [
            'asOf' => CarbonImmutable::now($p->zone)->toIso8601String(),
            'policy' => ['minimumStock' => $minStock, 'expiryWarningDays' => $policy->expiry_warning_days],
            'totals' => [
                'products' => $products->filter(fn ($pr) => $pr['units'] > 0)->count(),
                'units' => (int) $rows->sum('units'),
                'valueAtCost' => round($rows->sum('valueAtCost'), 2),
                'valueAtSelling' => round($rows->sum('valueAtSelling'), 2),
                'lowStock' => $productStatus->filter(fn ($s) => $s === 'Low Stock')->count(),
                'outOfStock' => count($outOfStock),
                'expiringSoon' => $count('Expiring Soon'),
                'expired' => $count('Expired'),
                'expiredValue' => round($rows->where('status', 'Expired')->sum('valueAtCost'), 2),
            ],
            // Batches by what they need: fine, low, expiring, expired
            'byStatus' => collect(['In Stock', 'Low Stock', 'Expiring Soon', 'Expired'])->map(fn ($s) => ['status' => $s, 'batches' => $count($s), 'units' => (int) $rows->where('status', $s)->sum('units')])->all(),
            'byBranch' => $rows->groupBy('branch')->map(fn (Collection $g, $branch) => [
                'branch' => $branch,
                'units' => (int) $g->sum('units'),
                'valueAtCost' => round($g->sum('valueAtCost'), 2),
                // Products below the minimum at this branch (a batch can show as expiring and still be low)
                'lowStock' => $productStatus->filter(fn ($s, $key) => $s === 'Low Stock' && str_starts_with($key, $g->first()['branchId'].'|'))->count(),
                'expiringSoon' => $g->where('status', 'Expiring Soon')->count(),
                'expired' => $g->where('status', 'Expired')->count(),
            ])->sortByDesc('valueAtCost')->values()->all(),
            'byCategory' => $rows->groupBy('category')->map(fn (Collection $g, $category) => ['category' => $category, 'units' => (int) $g->sum('units'), 'valueAtCost' => round($g->sum('valueAtCost'), 2)])
                ->sortByDesc('valueAtCost')->values()->all(),
            'movement' => $this->movement($p, $branches),
            'outOfStock' => $outOfStock,
            'rows' => $rows->all(),
        ];
    }

    /** Units in and out of each branch during the period */
    private function movement(ReportPeriod $p, Collection $branches): array
    {
        $sum = fn ($query, string $branchColumn) => $query->selectRaw("{$branchColumn} as branch_id, sum(qty) as units")->groupBy($branchColumn)->pluck('units', 'branch_id');
        $received = $sum($p->timestamps(DB::table('procurements'), 'received_at'), 'branch_id');
        $transferredIn = $sum($p->timestamps(DB::table('stock_transfers')->where('status', 'received'), 'received_at', 'to_branch_id'), 'to_branch_id');
        $sold = $sum($p->timestamps(DB::table('sales'), 'created_at'), 'branch_id');
        $transferredOut = $sum($p->timestamps(DB::table('stock_transfers'), 'created_at', 'from_branch_id'), 'from_branch_id');
        $damaged = $sum($p->dates(DB::table('damaged_items'), 'damage_date'), 'branch_id');
        $corrected = $p->timestamps(DB::table('stock_adjustments'), 'created_at')
            ->selectRaw('branch_id, sum(units_after - units_before) as units')->groupBy('branch_id')->pluck('units', 'branch_id');

        return $branches->keys()->filter(fn ($id) => ! $p->branchId || $id === $p->branchId)->map(fn ($id) => [
            'branch' => $branches[$id],
            'received' => (int) ($received[$id] ?? 0) + (int) ($transferredIn[$id] ?? 0),
            'sold' => (int) ($sold[$id] ?? 0),
            'transferredOut' => (int) ($transferredOut[$id] ?? 0),
            'damaged' => (int) ($damaged[$id] ?? 0),
            'corrected' => (int) ($corrected[$id] ?? 0),
        ])->sortBy('branch')->values()->all();
    }

    /** Purchase and selling price per product, found by catalog id or by name */
    private function prices(): array
    {
        $prices = [];
        foreach (DB::table('products')->get(['id', 'name', 'purchase_price', 'selling_price']) as $pr) {
            $entry = ['cost' => (float) $pr->purchase_price, 'selling' => (float) $pr->selling_price];
            $prices["id:{$pr->id}"] = $entry;
            $prices['name:'.StockBatch::keyFor($pr->name)] ??= $entry;
        }

        return $prices;
    }
}
