<?php

use App\Features\Accounts\Controllers\AccountController;
use App\Features\Accounts\Controllers\InvitationController;
use Illuminate\Support\Facades\Route;

// Public: opened from the invitation email
Route::middleware('throttle:20,1,invitations')->group(function () {
    Route::get('/invitations/{token}', [InvitationController::class, 'show']);
    Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);
});

// Account Provision (Owner only)
Route::middleware(['auth:sanctum', 'role:owner'])->group(function () {
    Route::get('/accounts', [AccountController::class, 'index']);
    Route::post('/accounts', [AccountController::class, 'store']);
    Route::patch('/accounts/{account}', [AccountController::class, 'update']);
    Route::delete('/accounts/{account}', [AccountController::class, 'destroy']);
    Route::post('/accounts/{account}/resend-invitation', [AccountController::class, 'resendInvitation']);
});
