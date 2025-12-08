<?php

namespace App\Features\Stock\Services;

use App\Features\Stock\Events\StockChanged;
use App\Features\Stock\Repositories\StockRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Collects the batches a request changed and pushes their new figures to each branch once, after the transaction
 * commits and the response is sent. A rolled-back change is never announced; a stopped Reverb server never breaks a save.
 * One per request (scoped in AppServiceProvider).
 */
class StockBroadcaster
{
    /** @var array<int, true> stock batch ids waiting to be announced */
    private array $pending = [];

    private bool $scheduled = false;

    public function changed(int $stockBatchId): void
    {
        // Noted only once the transaction commits (a rolled-back change is dropped with it), then sent after the response
        DB::afterCommit(function () use ($stockBatchId) {
            $this->pending[$stockBatchId] = true;
            if (! $this->scheduled) {
                $this->scheduled = true;
                app()->terminating(fn () => $this->send());
            }
        });
    }

    private function send(): void
    {
        $ids = array_keys($this->pending);
        $this->pending = [];
        $this->scheduled = false;

        foreach (app(StockRepository::class)->resources($ids)->groupBy('branchId') as $branchId => $batches) {
            try {
                broadcast(new StockChanged($branchId, $batches->values()->all()));
            } catch (Throwable $e) {
                Log::warning('Live stock update not sent', ['branch' => $branchId, 'error' => $e->getMessage()]);
            }
        }
    }
}
