<?php

namespace App\Features\Procurements\Controllers;

use App\Features\Procurements\Models\Procurement;
use App\Features\Procurements\Repositories\ProcurementRepository;
use App\Features\Procurements\Requests\StoreProcurementRequest;
use App\Features\Procurements\Resources\ProcurementResource;
use App\Features\Procurements\Services\ProcurementPayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ProcurementController
{
    public function __construct(
        private ProcurementPayments $payments,
        private ProcurementRepository $procurements,
    ) {}

    public function index(): AnonymousResourceCollection
    {
        return ProcurementResource::collection($this->procurements->latest());
    }

    // Saves the order as Pending and hands back Chapa's checkout page; stock arrives once the payment is verified
    public function store(StoreProcurementRequest $request): JsonResponse
    {
        $procurement = $this->procurements->createPending($request->validated(), $request->user()->id);

        try {
            $checkoutUrl = $this->payments->startCheckout($procurement, $request->user());
        } catch (HttpException $e) {
            $this->procurements->delete($procurement); // nothing to pay for, so don't keep an order that can never be settled
            throw $e;
        }

        return response()->json([
            'message' => "Procurement {$procurement->id} created. Complete the payment on Chapa to receive the stock.",
            'procurement' => new ProcurementResource($this->procurements->fresh($procurement)),
            'checkoutUrl' => $checkoutUrl,
        ], 201);
    }

    // The Procurement page calls this when Chapa sends the officer back
    public function verify(Procurement $procurement): JsonResponse
    {
        $procurement = $this->payments->sync($procurement);

        $message = match ($procurement->status) {
            'paid' => "Payment for {$procurement->id} confirmed. {$procurement->qty} × {$procurement->product} received into stock.",
            'failed' => "Payment for {$procurement->id} failed. No stock was received.",
            default => "Payment for {$procurement->id} isn't complete yet. Use Complete payment to finish it on Chapa.",
        };

        return response()->json([
            'message' => $message,
            'procurement' => new ProcurementResource($procurement),
        ]);
    }

    // Chapa's return_url. In the checkout popup it just closes, and the Procurement page underneath picks up the result;
    // opened as a full page (popup blocked) it sends the officer back to the Procurement page, which verifies from there.
    public function paymentReturn(string $procurement): View
    {
        return view('procurements::payment-return', [
            'appUrl' => rtrim(config('pharmacy.frontend_url'), '/').'/purchases?procurement='.rawurlencode($procurement),
        ]);
    }

    // Chapa calls this after a payment (GET or POST, with trx_ref); verified with Chapa before anything changes
    public function chapaCallback(Request $request): JsonResponse
    {
        $txRef = (string) ($request->input('trx_ref') ?? $request->input('tx_ref') ?? '');
        $procurement = $this->procurements->findByTxRef($txRef);

        if ($procurement) {
            $this->payments->sync($procurement);
        }

        return response()->json(['received' => true]);
    }
}
