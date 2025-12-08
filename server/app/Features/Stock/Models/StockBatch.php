<?php

namespace App\Features\Stock\Models;

use Illuminate\Database\Eloquent\Model;

// Units of one product's batch at one branch. Changed only by StockRepository, inside the transaction of the record that moves them.
class StockBatch extends Model
{
    protected $fillable = ['branch_id', 'product', 'product_key', 'category', 'med_id', 'batch', 'expiry_date', 'received_at', 'units'];

    protected function casts(): array
    {
        return ['units' => 'integer', 'expiry_date' => 'date:Y-m-d', 'received_at' => 'datetime'];
    }

    /** How products are matched: by name, ignoring case and surrounding spaces, like the app's catalog lookup */
    public static function keyFor(string $product): string
    {
        return mb_strtolower(trim($product));
    }
}
