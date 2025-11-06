<?php

namespace App\Features\Sales\Controllers;

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

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $unitPrice = round((float) $data['unitPrice'], 2);
        $sale = $this->sales->create([
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
        ]);
        $this->live->recorded($sale);

        return response()->json([
            'message' => "Sale {$sale->id} recorded: {$sale->qty} × {$sale->product}.",
            'sale' => new SaleResource($sale),
        ], 201);
    }
}
