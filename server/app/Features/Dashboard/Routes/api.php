<?php

use App\Features\Dashboard\Controllers\OwnerDashboardController;
use Illuminate\Support\Facades\Route;

// The Owner's dashboard figures (every branch, or one)
Route::middleware(['auth:sanctum', 'role:owner'])->get('/dashboard/owner', OwnerDashboardController::class);
