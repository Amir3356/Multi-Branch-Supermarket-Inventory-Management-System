<?php

namespace App\Features\AiAssistance\Services;

use App\Features\Stock\Models\StockBatch;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Forecasts and recommendations for the Owner's AI Assistance, calculated here from sales history and stock so the AI
 * explains real figures instead of guessing: next 30 days' revenue, when products run out, what to reorder and by when,
 * and stock likely to expire before it sells. Every branch.
 *
 * Method (kept simple and explainable): a product's daily sales rate is the units it sold at a branch over the recent
 * window (the last 30 days, or since sales began when that is shorter) divided by the window's days. Stock runs out
 * after sellable units ÷ rate days. A reorder covers 30 days of sales plus 7 days for delivery. Batches sell in
 * expiry order at the same rate.
 */
class Forecaster
{
    private const WINDOW_DAYS = 30;

    private const HISTORY_DAYS = 90;

    // Days of sales a reorder should cover once it arrives, and days a delivery is assumed to take
    private const COVER_DAYS = 30;

    private const LEAD_DAYS = 7;

    private const LIST_LIMIT = 15;

    private CarbonImmutable $today;

    private string $zone;

    public function build(int $minStock): array
    {
        $this->zone = config('pharmacy.timezone');
        $this->today = CarbonImmutable::now($this->zone)->startOfDay();
        $firstSale = DB::table('sales')->min('created_at');
        if (! $firstSale) {
            return ['basis' => 'No sales recorded yet, so nothing can be forecast. Forecasts start once sales come in.'];
        }

        $historyDays = min(self::HISTORY_DAYS, (int) CarbonImmutable::parse($firstSale, 'UTC')->setTimezone($this->zone)->startOfDay()->diffInDays($this->today) + 1);
        $window = min(self::WINDOW_DAYS, $historyDays);
        $since = $this->today->subDays($window - 1);
        $branches = DB::table('branches')->pluck('name', 'id');
        $costs = DB::table('products')->get(['name', 'purchase_price'])->mapWithKeys(fn ($p) => [StockBatch::keyFor($p->name) => (float) $p->purchase_price])->all();

        // Units sold per branch and product in the window → daily rate
        $rates = DB::table('sales')->where('created_at', '>=', $since->utc())
            ->selectRaw('branch_id, lower(trim(product)) as product_key, max(product) as product, sum(qty) as units')
            ->groupBy('branch_id', 'product_key')->get()
            ->mapWithKeys(fn ($r) => ["{$r->branch_id}|{$r->product_key}" => ['product' => $r->product, 'units' => (int) $r->units, 'rate' => $r->units / $window]]);

        $todayKey = $this->today->toDateString();
        $batches = StockBatch::where('units', '>', 0)->get()->groupBy(fn ($b) => "{$b->branch_id}|{$b->product_key}");
        $onOrder = DB::table('procurements')->where(fn ($q) => $q->where('status', 'pending')->orWhere(fn ($w) => $w->where('status', 'paid')->whereNull('received_at')))
            ->selectRaw('branch_id, lower(trim(product)) as product_key, sum(qty) as units')->groupBy('branch_id', 'product_key')->get()
            ->mapWithKeys(fn ($r) => ["{$r->branch_id}|{$r->product_key}" => (int) $r->units]);

        $stockOuts = [];
        $reorders = [];
        $expiryRisk = [];
        foreach ($rates->keys()->merge($batches->keys())->unique() as $key) {
            [$branchId, $productKey] = explode('|', $key, 2);
            $group = $batches->get($key, collect());
            $rate = $rates[$key]['rate'] ?? 0.0;
            $product = $rates[$key]['product'] ?? $group->first()?->product;
            $branch = $branches[$branchId] ?? $branchId;
            $sellable = $group->filter(fn ($b) => ! $b->expiry_date || $b->expiry_date->toDateString() >= $todayKey);
            $units = (int) $sellable->sum('units');
            $ordered = (int) ($onOrder[$key] ?? 0);

            if ($rate > 0) {
                $cover = $units / $rate;
                $runOut = $this->today->addDays((int) floor($cover));
                if ($cover <= self::COVER_DAYS + self::LEAD_DAYS) {
                    $stockOuts[] = ['branch' => $branch, 'product' => $product, 'unitsLeft' => $units, 'sellsPerDay' => round($rate, 2), 'daysLeft' => (int) floor($cover), 'runsOutOn' => $units > 0 ? $runOut->toDateString() : 'already out of stock'];
                }
                $need = (int) ceil($rate * (self::COVER_DAYS + self::LEAD_DAYS));
                $suggested = max(0, $need - $units - $ordered, $units + $ordered < $minStock ? $minStock - $units - $ordered : 0);
                if ($suggested > 0) {
                    $orderBy = $runOut->subDays(self::LEAD_DAYS);
                    $reorders[] = ['branch' => $branch, 'product' => $product, 'suggestedQty' => $suggested, 'unitsLeft' => $units, 'alreadyOnOrder' => $ordered, 'sellsPerDay' => round($rate, 2), 'orderBy' => $orderBy->lessThanOrEqualTo($this->today) ? 'now' : $orderBy->toDateString(), 'estimatedCost' => round($suggested * ($costs[$productKey] ?? 0), 2)];
                }
            }

            // Sell batches in expiry order at the current rate: what is still left when each one expires
            $sold = 0.0;
            foreach ($sellable->filter(fn ($b) => $b->expiry_date)->sortBy(fn ($b) => $b->expiry_date->toDateString()) as $b) {
                $daysToExpiry = (int) $this->today->diffInDays(CarbonImmutable::parse($b->expiry_date->toDateString(), $this->zone), false);
                $canSell = max(0.0, $rate * $daysToExpiry - $sold);
                $unsold = (int) max(0, $b->units - floor($canSell));
                $sold += min($b->units, $canSell);
                if ($unsold > 0 && $daysToExpiry <= 180) {
                    $expiryRisk[] = ['branch' => $branch, 'product' => $product, 'batch' => $b->batch, 'expires' => $b->expiry_date->toDateString(), 'daysToExpiry' => $daysToExpiry, 'unitsInBatch' => $b->units, 'unitsLikelyUnsold' => $unsold, 'valueAtRisk' => round($unsold * ($costs[$productKey] ?? 0), 2), 'betterBranch' => $this->fasterBranch($rates, $branches, $branchId, $productKey, $rate)];
                }
            }
        }

        usort($stockOuts, fn ($a, $b) => $a['daysLeft'] <=> $b['daysLeft']);
        usort($reorders, fn ($a, $b) => strcmp($a['orderBy'] === 'now' ? '0' : $a['orderBy'], $b['orderBy'] === 'now' ? '0' : $b['orderBy']));
        usort($expiryRisk, fn ($a, $b) => $b['valueAtRisk'] <=> $a['valueAtRisk']);

        $revenue = $this->revenue($since, $window, $historyDays, $branches);

        return [
            'basis' => "Calculated by the system from {$historyDays} days of sales history (since ".CarbonImmutable::parse($firstSale, 'UTC')->setTimezone($this->zone)->toDateString()."). Sales rates use the last {$window} days. "
                .'Reorders cover '.self::COVER_DAYS.' days of sales plus '.self::LEAD_DAYS.' days for delivery.',
            'confidence' => $historyDays < 30 ? 'low (under 30 days of history: treat as a rough guide)' : ($historyDays < 90 ? 'medium' : 'good'),
            'revenueNext30Days' => $revenue,
            'stockOuts' => array_slice($stockOuts, 0, self::LIST_LIMIT),
            'reorders' => array_slice($reorders, 0, self::LIST_LIMIT),
            'expiryRisk' => array_slice($expiryRisk, 0, self::LIST_LIMIT),
            'recommendations' => $this->recommendations($stockOuts, $reorders, $expiryRisk, $revenue),
        ];
    }

    /** Next 30 days' revenue at the recent daily average, per branch, with the trend once there is enough history */
    private function revenue(CarbonImmutable $since, int $window, int $historyDays, Collection $branches): array
    {
        $recent = DB::table('sales')->where('created_at', '>=', $since->utc())->selectRaw('branch_id, sum(total) as total')->groupBy('branch_id')->pluck('total', 'branch_id');
        $total = (float) $recent->sum();
        $trend = null;
        if ($historyDays >= 2 * self::WINDOW_DAYS) {
            $before = (float) DB::table('sales')->whereBetween('created_at', [$since->subDays(self::WINDOW_DAYS)->utc(), $since->utc()])->sum('total');
            $trend = $before > 0 ? round(($total - $before) / $before * 100, 1) : null;
        }

        return [
            'expected' => round($total / $window * 30, 2),
            'dailyAverage' => round($total / $window, 2),
            'trendVsPrevious30DaysPercent' => $trend,
            'byBranch' => $branches->map(fn ($name, $id) => ['branch' => $name, 'expected' => round((float) ($recent[$id] ?? 0) / $window * 30, 2)])->sortByDesc('expected')->values()->all(),
        ];
    }

    /** Another branch that sells this product faster, where expiring units could be sent */
    private function fasterBranch(Collection $rates, Collection $branches, string $branchId, string $productKey, float $rate): ?string
    {
        $best = $branches->keys()->filter(fn ($id) => $id !== $branchId)
            ->map(fn ($id) => ['branch' => $branches[$id], 'rate' => $rates["{$id}|{$productKey}"]['rate'] ?? 0])
            ->filter(fn ($b) => $b['rate'] > $rate)->sortByDesc('rate')->first();

        return $best ? "{$best['branch']} (sells ".round($best['rate'], 2).' a day)' : null;
    }

    /** What needs attention, most urgent first */
    private function recommendations(array $stockOuts, array $reorders, array $expiryRisk, array $revenue): array
    {
        $list = [];
        foreach ($stockOuts as $s) {
            if ($s['daysLeft'] <= self::LEAD_DAYS) {
                $list[] = ['priority' => 'high', 'text' => "{$s['product']} at {$s['branch']} ".($s['unitsLeft'] ? "runs out in about {$s['daysLeft']} days ({$s['unitsLeft']} left, sells {$s['sellsPerDay']} a day)" : 'is out of stock but still selling').': reorder now.'];
            }
        }
        foreach ($expiryRisk as $e) {
            $list[] = ['priority' => $e['daysToExpiry'] <= 30 ? 'high' : 'medium', 'text' => "{$e['unitsLikelyUnsold']} of {$e['unitsInBatch']} {$e['product']} (batch {$e['batch']}) at {$e['branch']} will likely expire unsold on {$e['expires']}, worth ETB {$e['valueAtRisk']}: "
                .($e['betterBranch'] ? "transfer them to {$e['betterBranch']}." : 'sell these first or stop reordering this product here.')];
        }
        foreach ($reorders as $r) {
            if ($r['orderBy'] !== 'now') {
                $list[] = ['priority' => 'medium', 'text' => "Order {$r['suggestedQty']} {$r['product']} for {$r['branch']} by {$r['orderBy']} (about ETB {$r['estimatedCost']})."];
            }
        }
        if (($revenue['trendVsPrevious30DaysPercent'] ?? 0) <= -10) {
            $list[] = ['priority' => 'medium', 'text' => "Revenue is down {$revenue['trendVsPrevious30DaysPercent']}% on the 30 days before."];
        }

        return array_slice($list, 0, self::LIST_LIMIT);
    }
}
