<?php

use App\Features\Procurements\Controllers\FakeChapaCheckoutController;
use App\Features\Procurements\Controllers\ProcurementController;
use Illuminate\Support\Facades\Route;

// Public: Chapa's server-to-server callback. It only triggers a verify with Chapa, so it can't fake a payment.
Route::middleware('throttle:60,1,chapa')
    ->match(['get', 'post'], '/procurements/chapa/callback', [ProcurementController::class, 'chapaCallback']);

// Public: where Chapa sends the officer after paying. Shows nothing about the order, it only closes or redirects.
Route::get('/procurements/{procurement}/payment-return', [ProcurementController::class, 'paymentReturn']);

// Every signed-in role needs paid procurements: they add to branch stock that inventory and reports show
Route::middleware('auth:sanctum')->get('/procurements', [ProcurementController::class, 'index']);

// Procurement sidebar (Procurement Officer only)
Route::middleware(['auth:sanctum', 'role:purchase_officer'])->group(function () {
    Route::post('/procurements', [ProcurementController::class, 'store']);
    Route::post('/procurements/{procurement}/verify', [ProcurementController::class, 'verify']);
});

// Inventory Officer: add a paid order's stock to their branch (Add Medicine)
Route::middleware(['auth:sanctum', 'role:pharmacist'])
    ->post('/procurements/{procurement}/receive', [ProcurementController::class, 'receive']);

// CHAPA_MODE=fake only: the pretend checkout page the officer is sent to instead of Chapa's
if (config('services.chapa.mode') === 'fake') {
    Route::get('/procurements/fake-checkout/{txRef}', [FakeChapaCheckoutController::class, 'show']);
    Route::post('/procurements/fake-checkout/{txRef}', [FakeChapaCheckoutController::class, 'complete']);
}
