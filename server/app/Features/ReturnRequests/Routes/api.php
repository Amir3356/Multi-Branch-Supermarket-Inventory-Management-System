<?php

use App\Features\ReturnRequests\Controllers\ReturnRequestController;
use Illuminate\Support\Facades\Route;

// Inventory Officer asks, Procurement Officer approves or rejects; the Owner can follow along.
// Everyone reads them: units on hold for a return can't be sold, so Cashiers need them too.
Route::middleware('auth:sanctum')
    ->get('/return-requests', [ReturnRequestController::class, 'index']);

Route::middleware(['auth:sanctum', 'role:pharmacist'])
    ->post('/return-requests', [ReturnRequestController::class, 'store']);

Route::middleware(['auth:sanctum', 'role:purchase_officer'])->group(function () {
    Route::post('/return-requests/{returnRequest}/approve', [ReturnRequestController::class, 'approve']);
    Route::post('/return-requests/{returnRequest}/reject', [ReturnRequestController::class, 'reject']);
    Route::post('/return-requests/{returnRequest}/replace', [ReturnRequestController::class, 'replace']);
});
