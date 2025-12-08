<?php

namespace App\Features\Stock\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Stock\Exceptions\InsufficientStock;
use App\Features\Stock\Models\StockBatch;
use App\Features\Stock\Services\StockBroadcaster;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use LogicException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Every change to a branch's stock. Each one runs inside the transaction that saves the record moving the units
 * (a sale, transfer, damaged item, received order, or a correction), so the record and the stock change are saved
 * together or not at all. Taking units is one guarded UPDATE (units >= n), which locks the batch row until that
 * transaction ends: two Cashiers or Inventory Officers taking the last units at the same moment can't both succeed.
 * Every change is pushed to the branch's screens once it commits (StockBroadcaster).
 */
class StockRepository
{
    public function __construct(private StockBroadcaster $broadcaster) {}

    // ---- Reading ----

    /** Every batch the user may see (their branch, or all for those who cover every branch), newest first, ready to send */
    public function visibleTo(User $user): Collection
    {
        return $this->present(StockBatch::query()
            ->when(! $user->coversAllBranches(), fn ($q) => $q->where('branch_id', $user->branch_id))
            ->orderByDesc('received_at')->orderByDesc('id')
            ->get());
    }

    /** These batches, ready to send */
    public function resources(array $ids): Collection
    {
        return $this->present(StockBatch::whereKey($ids)->get());
    }

    /**
     * Each batch's expiry date (YYYY-MM-DD, or null when none) for the batches of a product a branch holds; batches
     * missing from the result aren't in that branch's stock.
     */
    public function batchExpiries(string $branchId, string $product, array $batches): array
    {
        return StockBatch::where('branch_id', $branchId)->where('product_key', StockBatch::keyFor($product))->whereIn('batch', $batches)
            ->get(['batch', 'expiry_date'])
            ->mapWithKeys(fn (StockBatch $b) => [$b->batch => $b->expiry_date?->toDateString()])
            ->all();
    }

    // ---- Changing ----

    /** Units arriving at a branch under a batch: added to that batch, or a new batch row */
    public function add(string $branchId, string $product, string $category, ?string $medId, string $batch, ?string $expiry, int $units, mixed $receivedAt): void
    {
        $this->requireTransaction();
        $now = now();

        DB::table('stock_batches')->upsert(
            [[
                'branch_id' => $branchId,
                'product' => $product,
                'product_key' => StockBatch::keyFor($product),
                'category' => $category,
                'med_id' => $medId,
                'batch' => $batch,
                'expiry_date' => $expiry,
                'received_at' => $receivedAt,
                'units' => $units,
                'created_at' => $now,
                'updated_at' => $now,
            ]],
            ['branch_id', 'product_key', 'batch'],
            ['units' => DB::raw('stock_batches.units + excluded.units'), 'updated_at' => DB::raw('excluded.updated_at')],
        );

        $this->broadcaster->changed(StockBatch::where('branch_id', $branchId)->where('product_key', StockBatch::keyFor($product))->where('batch', $batch)->value('id'));
    }

    /**
     * Takes units out of one batch at a branch, only if it holds that many. With $expiredAction ("sold", "sent"), an
     * expired batch is refused too. Returns the batch as it is afterwards; throws InsufficientStock (422) otherwise.
     */
    public function take(string $branchId, string $product, string $batch, int $units, ?string $expiredAction = null): StockBatch
    {
        $this->requireTransaction();
        $today = now(config('pharmacy.timezone'))->toDateString();
        $row = fn (): Builder => StockBatch::where('branch_id', $branchId)->where('product_key', StockBatch::keyFor($product))->where('batch', $batch);

        $taken = $row()->where('units', '>=', $units)
            ->when($expiredAction, fn ($q) => $q->where(fn ($w) => $w->whereNull('expiry_date')->orWhere('expiry_date', '>=', $today)))
            ->decrement('units', $units);
        if ($taken === 1) {
            $after = $row()->first();
            $this->broadcaster->changed($after->id);

            return $after;
        }

        $current = $row()->first();
        if (! $current) {
            throw new InsufficientStock("Batch {$batch} of {$product} isn’t in stock at this branch.");
        }
        if ($expiredAction && $current->expiry_date && $current->expiry_date->toDateString() < $today) {
            throw new InsufficientStock("Batch {$batch} of {$product} expired on {$current->expiry_date->format('M j, Y')} and can’t be {$expiredAction}.");
        }
        if ($current->units >= $units) {
            // Units arrived between the two reads: rare, and trying again works
            throw new InsufficientStock("The stock of {$product} just changed. Try again.");
        }

        throw new InsufficientStock($current->units > 0
            ? "Only {$current->units} ".($current->units === 1 ? 'unit' : 'units')." of {$product} left in batch {$batch}, not {$units}. Someone else may have just used them: reload the page to see the latest stock."
            : "Batch {$batch} of {$product} has no units left. Someone else may have just used them: reload the page to see the latest stock.");
    }

    /**
     * Takes units from several batches of one product, all or none: [['batch' => …, 'qty' => …], …]. Batches are taken in
     * a fixed order (by batch number), so two requests sharing batches lock them in the same order and can't deadlock.
     */
    public function takeMany(string $branchId, string $product, array $parts, ?string $expiredAction = null): Collection
    {
        return collect($parts)
            ->sortBy('batch')
            ->map(fn (array $part) => $this->take($branchId, $product, $part['batch'], (int) $part['qty'], $expiredAction))
            ->values();
    }

    /**
     * An Inventory Officer's correction from the Inventory screen: the counted units and the expiry date. $expectedUnits is
     * what their screen showed; if a sale or another change moved the batch since, the correction is refused (409) instead
     * of silently undoing that change. Kept in stock_adjustments. Returns [before, after] for the audit log.
     */
    public function correct(StockBatch $batch, int $expectedUnits, int $units, ?string $expiry, User $by): array
    {
        return DB::transaction(function () use ($batch, $expectedUnits, $units, $expiry, $by) {
            $row = StockBatch::whereKey($batch->getKey())->lockForUpdate()->first();
            if ($row->units !== $expectedUnits) {
                throw new HttpException(409, "The stock of {$row->product} in batch {$row->batch} changed to {$row->units} since you opened this (a sale or another change). Check the new number and save again.");
            }

            $before = ['units' => $row->units, 'expiry' => $row->expiry_date?->toDateString()];
            if ($before === ['units' => $units, 'expiry' => $expiry]) {
                return [$before, $before];
            }

            $row->update(['units' => $units, 'expiry_date' => $expiry]);
            DB::table('stock_adjustments')->insert([
                'branch_id' => $row->branch_id,
                'product' => $row->product,
                'batch' => $row->batch,
                'units_before' => $before['units'],
                'units_after' => $units,
                'expiry_before' => $before['expiry'],
                'expiry_after' => $expiry,
                'adjusted_by' => $by->id,
                'created_at' => now(),
            ]);
            $this->broadcaster->changed($row->id);

            return [$before, ['units' => $units, 'expiry' => $expiry]];
        });
    }

    // ---- Helpers ----

    /**
     * Batches as the app's stock rows. The product's catalog id comes from the batch, or else the catalog entry with the
     * same name (preferring the same category), since an order for a product new to the catalog carries no id.
     */
    private function present(Collection $batches): Collection
    {
        $catalog = DB::table('products')->get(['id', 'name', 'category'])->groupBy(fn ($p) => StockBatch::keyFor($p->name));

        return $batches->map(function (StockBatch $b) use ($catalog) {
            $matches = $catalog->get($b->product_key, collect());
            $medId = $b->med_id ?? ($matches->firstWhere('category', $b->category) ?? $matches->first())?->id;

            return [
                'id' => $b->id,
                'branchId' => $b->branch_id,
                'medId' => $medId,
                'product' => $b->product,
                'category' => $b->category,
                'batch' => $b->batch,
                'expiry' => $b->expiry_date?->toDateString(),
                'stock' => $b->units,
                'receivedAt' => $b->received_at?->toIso8601String(),
            ];
        })->values();
    }

    private function requireTransaction(): void
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('Change stock inside the transaction that saves the record moving it.');
        }
    }
}
