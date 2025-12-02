<?php

use App\Features\DamagedItems\Controllers\DamagedItemController;
use Illuminate\Support\Facades\Route;

// Everyone reads damaged items (stock depends on them); the Inventory Officer records them at their branch
Route::middleware('auth:sanctum')->get('/damaged-items', [DamagedItemController::class, 'index']);
Route::middleware(['auth:sanctum', 'role:pharmacist'])->post('/damaged-items', [DamagedItemController::class, 'store']);
