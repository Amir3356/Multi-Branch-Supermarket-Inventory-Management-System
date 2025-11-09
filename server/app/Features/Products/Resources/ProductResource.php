<?php

namespace App\Features\Products\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            // Null until the product's stock is first added (purchase) or it is set up for sale (selling)
            'purchasePrice' => $this->purchase_price === null ? null : (float) $this->purchase_price,
            'sellingPrice' => $this->selling_price === null ? null : (float) $this->selling_price,
        ];
    }
}
