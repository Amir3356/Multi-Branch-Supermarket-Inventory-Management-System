<?php

namespace App\Features\Products\Models;

use Illuminate\Database\Eloquent\Model;

// One product in the catalog
class Product extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'name', 'category', 'purchase_price', 'selling_price', 'price_set_by'];

    protected function casts(): array
    {
        return ['purchase_price' => 'decimal:2', 'selling_price' => 'decimal:2'];
    }
}
