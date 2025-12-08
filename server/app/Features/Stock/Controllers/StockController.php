<?php

namespace App\Features\Stock\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Stock\Models\StockBatch;
use App\Features\Stock\Repositories\StockRepository;
use App\Features\Stock\Requests\UpdateStockBatchRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Each branch's stock per batch, as the server holds it: every screen shows this instead of working it out itself
class StockController
{
    public function __construct(private StockRepository $stock) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->stock->visibleTo($request->user())]);
    }

    public function update(UpdateStockBatchRequest $request, StockBatch $stockBatch): JsonResponse
    {
        $data = $request->validated();
        [$before, $after] = $this->stock->correct($stockBatch, $data['expectedStock'], $data['stock'], $data['expiry'] ?? null, $request->user());

        $changes = array_filter([
            $before['units'] !== $after['units'] ? "stock {$before['units']} → {$after['units']}" : null,
            $before['expiry'] !== $after['expiry'] ? 'expiry '.($before['expiry'] ?? 'none').' → '.($after['expiry'] ?? 'none') : null,
        ]);
        if ($changes) {
            app(AuditLogger::class)->record('Inventory', 'Stock corrected', $stockBatch->batch, "{$stockBatch->product} batch {$stockBatch->batch}: ".implode(', ', $changes).'.', $stockBatch->branch_id);
        }

        return response()->json([
            'message' => $changes ? "{$stockBatch->product} batch {$stockBatch->batch} updated." : 'No changes to save.',
            'batch' => $this->stock->resources([$stockBatch->id])->first(),
        ]);
    }
}
