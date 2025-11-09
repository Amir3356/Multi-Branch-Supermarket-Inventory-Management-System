<?php

use App\Features\Products\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

// Every signed-in role reads the catalog (procurement, inventory, sales, transfers)
Route::middleware('auth:sanctum')->get('/products', [ProductController::class, 'index']);
// The Inventory Officer sets a product's selling price (Edit); Add Medicine sets it when stock is added
Route::middleware(['auth:sanctum', 'role:pharmacist'])->put('/products/{product}/selling-price', [ProductController::class, 'updateSellingPrice']);
