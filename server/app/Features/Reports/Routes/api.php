<?php

use App\Features\Reports\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// The Owner's reports (read only)
Route::middleware(['auth:sanctum', 'role:owner'])->prefix('reports')->group(function () {
    Route::get('/financial', [ReportController::class, 'financial']);
    Route::get('/users', [ReportController::class, 'users']);
});

// The Procurement Report is the Procurement Officer's too: they buy for every branch
Route::middleware(['auth:sanctum', 'role:owner,purchase_officer'])->get('/reports/procurement', [ReportController::class, 'procurement']);

// The Pharmacist sees the Inventory Report for their own branch (the controller keeps them to it)
Route::middleware(['auth:sanctum', 'role:owner,pharmacist'])->get('/reports/inventory', [ReportController::class, 'inventory']);

// The Cashier sees the Sales Report for their own branch, without purchase-price figures
Route::middleware(['auth:sanctum', 'role:owner,cashier'])->get('/reports/sales', [ReportController::class, 'sales']);
