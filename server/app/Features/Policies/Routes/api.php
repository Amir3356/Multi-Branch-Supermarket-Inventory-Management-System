<?php

use App\Features\Policies\Controllers\PolicyController;
use Illuminate\Support\Facades\Route;

// Everyone reads the policy (Low Stock and Expiring Soon depend on it); the Inventory Officer (Policy page) changes it
Route::middleware('auth:sanctum')->get('/policy', [PolicyController::class, 'show']);
Route::middleware(['auth:sanctum', 'role:pharmacist'])->put('/policy', [PolicyController::class, 'update']);
