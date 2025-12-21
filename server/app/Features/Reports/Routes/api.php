<?php

use App\Features\Reports\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// The Owner's reports (read only)
Route::middleware(['auth:sanctum', 'role:owner'])->prefix('reports')->group(function () {
    Route::get('/sales', [ReportController::class, 'sales']);
    Route::get('/inventory', [ReportController::class, 'inventory']);
    Route::get('/financial', [ReportController::class, 'financial']);
    Route::get('/procurement', [ReportController::class, 'procurement']);
    Route::get('/users', [ReportController::class, 'users']);
});
