<?php

use App\Features\Sessions\Controllers\SessionController;
use Illuminate\Support\Facades\Route;

// Session Monitoring & Management (Owner only)
Route::middleware(['auth:sanctum', 'role:owner'])->group(function () {
    Route::get('/sessions', [SessionController::class, 'index']);
    Route::post('/sessions/{session}/end', [SessionController::class, 'end']);
    Route::delete('/sessions/{session}', [SessionController::class, 'destroy']);
});
