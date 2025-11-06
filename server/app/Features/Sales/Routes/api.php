<?php

use App\Features\Sales\Controllers\SaleController;
use Illuminate\Support\Facades\Route;

// Everyone reads sales (stock depends on them); the Cashier records them at their branch
Route::middleware('auth:sanctum')->get('/sales', [SaleController::class, 'index']);
Route::middleware(['auth:sanctum', 'role:cashier'])->post('/sales', [SaleController::class, 'store']);
