<?php

namespace App\Features\Procurements\Controllers;

use App\Features\Procurements\Models\Procurement;
use App\Features\Procurements\Requests\StoreProcurementRequest;
use App\Features\Procurements\Resources\ProcurementResource;
use App\Features\Procurements\Services\ProcurementPayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ProcurementController
{
    public function __construct(private ProcurementPayments $payments) {}

    public function index(): AnonymousResourceCollection
    {
        return ProcurementResource::collection(Procurement::latest()->get());
    }

    // Saves the order as Pending and hands back Chapa's checkout page; stock arrives once the payment is verified
    public function store(StoreProcurementRequest $request): JsonResponse
    {
        $data = $request->validated();

        $procurement = DB::transaction(function () use ($data, $request) {
            $id = Procurement::nextId();

            return Procurement::create([
                'id' => $id,
                'branch_id' => $data['branchId'],
                'created_by' => $request->user()->id,
                'supplier' => $data['supplier'],
                'category' => $data['category'],
                'product' => $data['product'],
                'med_id' => $data['medId'] ?? null,
                'qty' => $data['qty'],
                'unit_price' => round($data['purchasePrice'], 2),
                'total' => round($data['qty'] * round($data['purchasePrice'], 2), 2),
                'currency' => $data['currency'],
                'status' => 'pending',
                'tx_ref' => $id.'-'.Str::lower(Str::random(12)),
            ]);
        });

        try {
            $checkoutUrl = $this->payments->startCheckout($procurement, $request->user());
        } catch (HttpException $e) {
            $procurement->delete(); // nothing to pay for, so don't keep an order that can never be settled
            throw $e;
        }

        return response()->json([
            'message' => "Procurement {$procurement->id} created. Complete the payment on Chapa to receive the stock.",
            'procurement' => new ProcurementResource($procurement->fresh()),
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

    // Chapa calls this after a payment (GET or POST, with trx_ref); verified with Chapa before anything changes
    public function chapaCallback(Request $request): JsonResponse
    {
        $txRef = (string) ($request->input('trx_ref') ?? $request->input('tx_ref') ?? '');
        $procurement = Procurement::where('tx_ref', $txRef)->first();

        if ($procurement) {
            $this->payments->sync($procurement);
        }

        return response()->json(['received' => true]);
    }
}
