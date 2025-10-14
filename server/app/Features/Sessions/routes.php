<?php

use App\Features\Sessions\Controllers\DeviceLocationController;
use App\Features\Sessions\Controllers\SessionController;
use Illuminate\Support\Facades\Route;

// Every signed-in user: the browser reports this session's location, if the person allowed it
Route::middleware(['auth:sanctum', 'throttle:10,1,device-location'])
    ->post('/sessions/current/location', DeviceLocationController::class);

// Session Monitoring & Management (Owner only)
Route::middleware(['auth:sanctum', 'role:owner'])->group(function () {
    Route::get('/sessions', [SessionController::class, 'index']);
    Route::post('/sessions/{session}/end', [SessionController::class, 'end']);
    Route::delete('/sessions/{session}', [SessionController::class, 'destroy']);
});
