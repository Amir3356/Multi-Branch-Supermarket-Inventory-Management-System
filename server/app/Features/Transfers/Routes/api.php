<?php

use App\Features\Transfers\Controllers\TransferController;
use Illuminate\Support\Facades\Route;

// Everyone reads transfers (stock depends on them); Inventory Officers and the Owner send; the receiving branch's
// Inventory Officer adds them to stock
Route::middleware('auth:sanctum')->get('/transfers', [TransferController::class, 'index']);
Route::middleware(['auth:sanctum', 'role:pharmacist,owner'])->post('/transfers', [TransferController::class, 'store']);
Route::middleware(['auth:sanctum', 'role:pharmacist'])->post('/transfers/{transfer}/receive', [TransferController::class, 'receive']);
