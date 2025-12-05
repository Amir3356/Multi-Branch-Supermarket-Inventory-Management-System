<?php

use App\Features\AiAssistance\Controllers\AiAssistanceController;
use Illuminate\Support\Facades\Route;

// AI Assistance for every role; each AI call costs time and quota, so a user gets 20 a minute
Route::middleware(['auth:sanctum', 'role:owner,pharmacist,cashier,purchase_officer', 'throttle:20,1'])->prefix('ai')->group(function () {
    Route::get('/recommendations', [AiAssistanceController::class, 'recommendations']);
    Route::post('/chat', [AiAssistanceController::class, 'chat']);
});
