<?php

namespace App\Features\Products\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Products\Models\Product;
use Illuminate\Support\Collection;

// Every database read and write for the product catalog
class ProductRepository
{
    /** The whole catalog, by category then name */
    public function all(): Collection
    {
        return Product::orderBy('category')->orderBy('name')->get();
    }

    /** Sets the shared prices of a product (either may be left out); returns null when the product isn't in the catalog */
    public function setPrices(?string $id, ?float $purchasePrice, ?float $sellingPrice, User $by): ?Product
    {
        $product = $id ? Product::find($id) : null;
        if (! $product) {
            return null;
        }
        $product->update(array_filter([
            'purchase_price' => $purchasePrice === null ? null : round($purchasePrice, 2),
            'selling_price' => $sellingPrice === null ? null : round($sellingPrice, 2),
        ], fn ($value) => $value !== null) + ['price_set_by' => $by->id]);

        return $product;
    }
}
