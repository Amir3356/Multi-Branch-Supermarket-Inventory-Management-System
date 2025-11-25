<?php

namespace App\Features\Sales\Controllers;

use App\Features\Sales\Models\Sale;
use App\Features\Sales\Repositories\SaleRepository;
use App\Features\Sales\Requests\StoreSaleRequest;
use App\Features\Sales\Resources\SaleResource;
use App\Features\Sales\Services\SaleBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

// Sales: the Cashier records them at their branch; every screen's stock follows
class SaleController
{
    public function __construct(private SaleRepository $sales, private SaleBroadcaster $live) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return SaleResource::collection($this->sales->visibleTo($request->user()));
    }

    /**
     * Records a sale. The Idempotency-Key header makes it safe to send again: a repeat returns the sale already
     * recorded (200, Idempotent-Replayed: true) instead of selling the units twice.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $unitPrice = round((float) $data['unitPrice'], 2);
        [$sale, $created] = $this->sales->createOnce([
            'branch_id' => $data['branchId'],
            'customer' => $data['customer'],
            'category' => $data['category'],
            'product' => $data['product'],
            'med_id' => $data['medId'] ?? null,
            'qty' => $data['qty'],
            'unit_price' => $unitPrice,
            'total' => round($unitPrice * $data['qty'], 2),
            'status' => 'paid',
            'sold_by' => $request->user()->id,
            'idempotency_key' => $data['idempotencyKey'],
        ]);

        // The same key with a different sale is a mistake on the client, not a retry
        if (! $created && ! $this->sameSale($sale, $data, $unitPrice)) {
            return response()->json([
                'message' => "This sale was already recorded as {$sale->id} ({$sale->qty} × {$sale->product}). Close this window and start a new sale.",
            ], 422);
        }

        if ($created) {
            $this->live->recorded($sale);
        }

        return response()->json([
            'message' => "Sale {$sale->id} recorded: {$sale->qty} × {$sale->product}.",
            'sale' => new SaleResource($sale),
        ], $created ? 201 : 200)->header('Idempotent-Replayed', $created ? 'false' : 'true');
    }

    private function sameSale(Sale $sale, array $data, float $unitPrice): bool
    {
        return $sale->branch_id === $data['branchId']
            && $sale->product === $data['product']
            && $sale->med_id === ($data['medId'] ?? null)
            && $sale->qty === (int) $data['qty']
            && (float) $sale->unit_price === $unitPrice
            && $sale->customer === $data['customer'];
    }
}
