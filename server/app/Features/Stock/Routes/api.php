<?php

use App\Features\Stock\Controllers\StockController;
use Illuminate\Support\Facades\Route;

// Stock per batch: everyone sees their branch (or all branches); the Inventory Officer corrects their own branch's
Route::middleware('auth:sanctum')->get('/stock', [StockController::class, 'index']);
Route::middleware(['auth:sanctum', 'role:pharmacist', 'branch.active:correct stock'])->patch('/stock/{stockBatch}', [StockController::class, 'update']);
