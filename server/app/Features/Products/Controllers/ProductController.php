<?php

namespace App\Features\Products\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Products\Models\Product;
use App\Features\Products\Repositories\ProductRepository;
use App\Features\Products\Requests\UpdateSellingPriceRequest;
use App\Features\Products\Resources\ProductResource;
use App\Features\Products\Services\ProductBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

// The product catalog: every page that picks a product reads it; prices are shared by every branch
class ProductController
{
    public function __construct(private ProductRepository $products, private ProductBroadcaster $live) {}

    public function index(): AnonymousResourceCollection
    {
        return ProductResource::collection($this->products->all());
    }

    // Inventory Officer (Edit): the unit selling price, at every branch
    public function updateSellingPrice(UpdateSellingPriceRequest $request, Product $product): JsonResponse
    {
        $previous = $product->selling_price;
        $updated = $this->products->setPrices($product->id, null, (float) $request->validated('sellingPrice'), $request->user());
        app(AuditLogger::class)->record('Products', 'Selling price changed', $updated->id, "{$updated->name}: ".($previous === null ? 'not set' : AuditLogger::money($previous)).' → '.AuditLogger::money($updated->selling_price).' at every branch.', $request->user()->branch_id);
        $this->live->changed();

        return response()->json(['message' => "{$updated->name} now sells for {$updated->selling_price} at every branch.", 'product' => new ProductResource($updated)]);
    }
}
