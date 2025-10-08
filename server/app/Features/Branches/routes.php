<?php

use App\Features\Branches\Controllers\BranchController;
use Illuminate\Support\Facades\Route;

// Every signed-in role needs the branch list (labels, pickers)
Route::middleware('auth:sanctum')->get('/branches', [BranchController::class, 'index']);

// Branches sidebar (Owner only)
Route::middleware(['auth:sanctum', 'role:owner'])->group(function () {
    Route::post('/branches', [BranchController::class, 'store']);
    Route::patch('/branches/{branch}', [BranchController::class, 'update']);
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);
});
