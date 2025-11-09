<?php

use App\Features\Expenses\Controllers\ExpenseController;
use Illuminate\Support\Facades\Route;

// The Expenses sidebar (Inventory Officer): their branch's expenses; the Owner and Procurement Officer can read all
Route::middleware(['auth:sanctum', 'role:pharmacist,owner,purchase_officer'])->get('/expenses', [ExpenseController::class, 'index']);
Route::middleware(['auth:sanctum', 'role:pharmacist'])->group(function () {
    Route::post('/expenses', [ExpenseController::class, 'store']);
    Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy']);
});
