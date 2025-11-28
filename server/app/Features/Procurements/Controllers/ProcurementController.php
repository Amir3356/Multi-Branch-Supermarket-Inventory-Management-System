<?php

namespace App\Features\Procurements\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Procurements\Models\Procurement;
use App\Features\Procurements\Repositories\ProcurementRepository;
use App\Features\Procurements\Requests\StoreProcurementRequest;
use App\Features\Procurements\Resources\ProcurementResource;
use App\Features\Procurements\Services\ProcurementBroadcaster;
use App\Features\Products\Repositories\ProductRepository;
use App\Features\Products\Services\ProductBroadcaster;
use App\Features\Procurements\Services\ProcurementPayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ProcurementController
{
    public function __construct(
        private ProcurementPayments $payments,
        private ProcurementRepository $procurements,
        private ProcurementBroadcaster $live,
        private ProductRepository $products,
        private ProductBroadcaster $catalog,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return ProcurementResource::collection($this->procurements->visibleTo($request->user()));
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

        app(AuditLogger::class)->record('Procurement', 'Procurement created', $procurement->id, "{$procurement->qty} × {$procurement->product} from {$procurement->supplier} for ".AuditLogger::money($procurement->total, $procurement->currency).'; awaiting Chapa payment.', $procurement->branch_id);

        // New Pending order: shows on other screens (e.g. the Owner's) right away
        $this->live->changed($procurement);

        return response()->json([
            'message' => "Procurement {$procurement->id} created. Complete the payment on Chapa to receive the stock.",
            'procurement' => new ProcurementResource($this->procurements->fresh($procurement)),
            'checkoutUrl' => $checkoutUrl,
        ], 201);
    }

    // Inventory Officer (Add Medicine): add a paid order's stock to their own branch, once
    public function receive(Request $request, Procurement $procurement): JsonResponse
    {
        if ($procurement->branch_id !== $request->user()->branch_id) {
            abort(403, 'This procurement was bought for another branch.');
        }
        // "Today" in the pharmacy's local time: stock that has already expired can't be added
        $today = now(config('pharmacy.timezone'))->toDateString();
        $data = $request->validate([
            'expiryDate' => ['required', 'date_format:Y-m-d', "after:{$today}"],
            'sellingPrice' => ['required', 'numeric', 'gt:0', 'max:10000000'],
        ], [
            'expiryDate.required' => 'Enter the expiration date printed on the package.',
            'expiryDate.after' => 'This stock has already expired; it can’t be added.',
            'sellingPrice.*' => 'Enter a selling price greater than 0',
        ]);

        // The batch number is generated (BT-00001, …) when the stock is added
        $received = DB::transaction(function () use ($procurement, $request, $data) {
            $locked = $this->procurements->lockForUpdate($procurement);
            if (! $locked->awaitsReceipt()) {
                abort(422, $locked->received_at ? 'This procurement was already added to stock.' : 'Only a paid procurement can be added to stock.');
            }

            // The product's shared prices: what one unit cost on this order, and what it sells for at every branch
            $this->products->setPrices($locked->med_id, (float) $locked->unit_price, (float) $data['sellingPrice'], $request->user());

            return $this->procurements->markReceived($locked, $request->user()->id, $data['expiryDate']);
        });
        $this->live->changed($received);
        $this->catalog->changed();
        app(AuditLogger::class)->record('Procurement', 'Stock added', $received->id, "{$received->qty} × {$received->product} added as batch {$received->batch} (expires {$data['expiryDate']}), selling at ".AuditLogger::money($data['sellingPrice']).'.', $received->branch_id);

        return response()->json([
            'message' => "{$received->qty} × {$received->product} (batch {$received->batch}) added to stock.",
            'procurement' => new ProcurementResource($received),
        ]);
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
