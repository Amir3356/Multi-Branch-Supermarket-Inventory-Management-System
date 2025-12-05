<?php

namespace App\Features\AiAssistance\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Each branch's stock per batch, worked out from the records the way the React app's stock slice replays them:
 * received procurements and received transfers add a batch; transfers sent, sales and damaged items take units out
 * of the named batch, or first-in, first-out (not-expired batches, oldest first) when that batch isn't known.
 * Manual stock corrections made in a browser's Inventory screen are not on the server, so they aren't counted here.
 */
class StockLedger
{
    /** @var array<string, array> batch rows keyed "branch|product|batch" */
    private array $rows = [];

    private string $today;

    /**
     * Batches with their units left: [branchId, product, category, batch, expiry (Y-m-d|null), receivedAt, stock].
     * Products are matched by name, like the app's catalog lookup.
     */
    public function batches(): Collection
    {
        $this->rows = [];
        $this->today = now(config('pharmacy.timezone'))->toDateString();

        $this->receiveAll();

        // Units leave in the order they happened, so FIFO picks the same batches the app does
        $out = collect()
            ->concat(DB::table('stock_transfers')->get(['from_branch_id as branch', 'product', 'batch', 'qty', 'created_at'])
                ->map(fn ($t) => ['branch' => $t->branch, 'product' => $t->product, 'parts' => [[$t->batch, (int) $t->qty]], 'at' => $t->created_at]))
            ->concat(DB::table('damaged_items')->get(['branch_id as branch', 'product', 'batch', 'qty', 'created_at'])
                ->map(fn ($d) => ['branch' => $d->branch, 'product' => $d->product, 'parts' => [[$d->batch, (int) $d->qty]], 'at' => $d->created_at]))
            ->concat(DB::table('sales')->get(['branch_id as branch', 'product', 'batches', 'qty', 'created_at'])
                ->map(function ($s) {
                    $batches = json_decode($s->batches ?? '[]', true) ?: [];
                    $parts = $batches ? array_map(fn ($b) => [$b['batch'] ?? null, (int) ($b['qty'] ?? 0)], $batches) : [[null, (int) $s->qty]];

                    return ['branch' => $s->branch, 'product' => $s->product, 'parts' => $parts, 'at' => $s->created_at];
                }))
            ->sortBy('at');

        foreach ($out as $movement) {
            foreach ($movement['parts'] as [$batch, $qty]) {
                $this->takeOut($movement['branch'], $movement['product'], $batch, $qty);
            }
        }

        return collect(array_values($this->rows));
    }

    private function receiveAll(): void
    {
        $arrivals = collect()
            ->concat(DB::table('procurements')->whereNotNull('received_at')
                ->get(['branch_id as branch', 'product', 'category', DB::raw('coalesce(batch, id) as batch'), 'expiry_date as expiry', 'received_at', 'qty']))
            ->concat(DB::table('stock_transfers')->where('status', 'received')
                ->get(['to_branch_id as branch', 'product', 'category', DB::raw('coalesce(received_batch, batch) as batch'), 'expiry_date as expiry', 'received_at', 'qty']))
            ->sortBy('received_at');

        foreach ($arrivals as $a) {
            $key = $this->key($a->branch, $a->product, $a->batch);
            $this->rows[$key] ??= [
                'branchId' => $a->branch,
                'product' => $a->product,
                'category' => $a->category,
                'batch' => $a->batch,
                'expiry' => $a->expiry ? substr((string) $a->expiry, 0, 10) : null,
                'receivedAt' => (string) $a->received_at,
                'stock' => 0,
            ];
            $this->rows[$key]['stock'] += (int) $a->qty;
        }
    }

    private function takeOut(string $branch, string $product, ?string $batch, int $qty): void
    {
        $key = $batch !== null ? $this->key($branch, $product, $batch) : null;
        if ($key && isset($this->rows[$key])) {
            $this->rows[$key]['stock'] -= $qty;

            return;
        }

        // The product's batches at the branch: not-expired with stock, oldest first; then the rest
        $mine = array_filter($this->rows, fn ($r) => $r['branchId'] === $branch && $this->same($r['product'], $product));
        if (! $mine) {
            return; // the app skips it too until the stock arrives
        }
        uasort($mine, fn ($a, $b) => [$a['receivedAt'], $a['batch']] <=> [$b['receivedAt'], $b['batch']]);
        $fifo = array_filter($mine, fn ($r) => $r['stock'] > 0 && ! $this->isExpired($r['expiry']));
        $order = array_keys($fifo + $mine);

        $left = $qty;
        foreach ($order as $k) {
            if ($left <= 0) {
                break;
            }
            $units = min($left, max(0, $this->rows[$k]['stock']));
            $this->rows[$k]['stock'] -= $units;
            $left -= $units;
        }
        if ($left > 0) {
            $this->rows[$order[0]]['stock'] -= $left;
        }
    }

    public function isExpired(?string $expiry): bool
    {
        return $expiry !== null && $expiry < $this->today;
    }

    private function key(string $branch, string $product, string $batch): string
    {
        return $branch.'|'.mb_strtolower(trim($product)).'|'.$batch;
    }

    private function same(string $a, string $b): bool
    {
        return mb_strtolower(trim($a)) === mb_strtolower(trim($b));
    }
}
