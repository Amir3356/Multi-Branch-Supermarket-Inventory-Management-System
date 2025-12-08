<?php

namespace App\Features\Stock\Services;

use App\Features\Stock\Models\StockBatch;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Works out every branch's stock per batch from the records and saves it to stock_batches, replacing what is there.
 * The records are replayed the way the React app's stock slice does: received procurements and received transfers
 * add a batch; transfers sent, sales and damaged items take units out of the named batch, or first-in, first-out
 * (not-expired batches, oldest first) when that batch isn't known; Inventory Officers' corrections (stock_adjustments)
 * change a batch's units by what they changed them by, and set its expiry. Used once when stock_batches is created,
 * and by `php artisan stock:rebuild` to repair it.
 */
class StockRebuilder
{
    /** @var array<string, array> batch rows keyed "branch|product|batch" */
    private array $rows = [];

    private string $today;

    /** Rebuilds the table; returns the number of batches saved and those that came out below zero (saved as 0) */
    public function rebuild(): array
    {
        return DB::transaction(function () {
            // Holds back every sale, transfer, damaged item and receipt until the new figures are saved
            DB::statement('lock table stock_batches in exclusive mode');

            $batches = $this->replay();
            $belowZero = array_values(array_filter($batches, fn ($b) => $b['stock'] < 0));
            $now = now();

            DB::table('stock_batches')->delete();
            foreach (array_chunk($batches, 500) as $chunk) {
                DB::table('stock_batches')->insert(array_map(fn ($b) => [
                    'branch_id' => $b['branchId'],
                    'product' => $b['product'],
                    'product_key' => StockBatch::keyFor($b['product']),
                    'category' => $b['category'],
                    'med_id' => $b['medId'],
                    'batch' => $b['batch'],
                    'expiry_date' => $b['expiry'],
                    'received_at' => $b['receivedAt'],
                    'units' => max(0, $b['stock']),
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk));
            }

            return ['batches' => count($batches), 'belowZero' => $belowZero];
        });
    }

    /** Batches with their units left (can be negative when more left a batch than arrived) */
    private function replay(): array
    {
        $this->rows = [];
        $this->today = now(config('pharmacy.timezone'))->toDateString();

        $arrivals = collect()
            ->concat(DB::table('procurements')->whereNotNull('received_at')
                ->get(['branch_id as branch', 'product', 'category', 'med_id', DB::raw('coalesce(batch, id) as batch'), 'expiry_date as expiry', 'received_at', 'qty']))
            ->concat(DB::table('stock_transfers')->where('status', 'received')
                ->get(['to_branch_id as branch', 'product', 'category', 'med_id', DB::raw('coalesce(received_batch, batch) as batch'), 'expiry_date as expiry', 'received_at', 'qty']))
            ->sortBy('received_at');

        foreach ($arrivals as $a) {
            $key = $this->key($a->branch, $a->product, $a->batch);
            $this->rows[$key] ??= [
                'branchId' => $a->branch,
                'product' => $a->product,
                'category' => $a->category,
                'medId' => $a->med_id,
                'batch' => $a->batch,
                'expiry' => $a->expiry ? substr((string) $a->expiry, 0, 10) : null,
                'receivedAt' => $a->received_at,
                'stock' => 0,
            ];
            $this->rows[$key]['stock'] += (int) $a->qty;
        }

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
            ->concat(Schema::hasTable('stock_adjustments') ? DB::table('stock_adjustments')->get()
                ->map(fn ($a) => ['branch' => $a->branch_id, 'product' => $a->product, 'adjust' => $a, 'at' => $a->created_at]) : [])
            ->sortBy('at');

        foreach ($out as $movement) {
            if (isset($movement['adjust'])) {
                $this->adjust($movement['adjust']);

                continue;
            }
            foreach ($movement['parts'] as [$batch, $qty]) {
                $this->takeOut($movement['branch'], $movement['product'], $batch, $qty);
            }
        }

        return array_values($this->rows);
    }

    /** A correction from the Inventory screen: the batch moves by what the officer changed it by, and takes the new expiry */
    private function adjust(object $a): void
    {
        $key = $this->key($a->branch_id, $a->product, $a->batch);
        if (! isset($this->rows[$key])) {
            return;
        }
        $this->rows[$key]['stock'] += $a->units_after - $a->units_before;
        $this->rows[$key]['expiry'] = $a->expiry_after ? substr((string) $a->expiry_after, 0, 10) : null;
    }

    private function takeOut(string $branch, string $product, ?string $batch, int $qty): void
    {
        $key = $batch !== null ? $this->key($branch, $product, $batch) : null;
        if ($key && isset($this->rows[$key])) {
            $this->rows[$key]['stock'] -= $qty;

            return;
        }

        // The product's batches at the branch: not-expired with stock, oldest first; then the rest
        $mine = array_filter($this->rows, fn ($r) => $r['branchId'] === $branch && StockBatch::keyFor($r['product']) === StockBatch::keyFor($product));
        if (! $mine) {
            return; // the app skips it too until the stock arrives
        }
        uasort($mine, fn ($a, $b) => [(string) $a['receivedAt'], $a['batch']] <=> [(string) $b['receivedAt'], $b['batch']]);
        $fifo = array_filter($mine, fn ($r) => $r['stock'] > 0 && ! ($r['expiry'] !== null && $r['expiry'] < $this->today));
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

    private function key(string $branch, string $product, string $batch): string
    {
        return $branch.'|'.StockBatch::keyFor($product).'|'.$batch;
    }
}
