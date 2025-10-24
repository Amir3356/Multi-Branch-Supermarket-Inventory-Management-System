<?php

use App\Features\AccessReviews\Controllers\AccessReviewController;
use Illuminate\Support\Facades\Route;

// Access reviews (Owner only)
Route::middleware(['auth:sanctum', 'role:owner'])->group(function () {
    Route::get('/access-reviews', [AccessReviewController::class, 'index']);
    Route::post('/access-reviews', [AccessReviewController::class, 'store']);
    Route::get('/access-reviews/{accessReview}', [AccessReviewController::class, 'show']);
    Route::delete('/access-reviews/{accessReview}', [AccessReviewController::class, 'destroy']);
});
