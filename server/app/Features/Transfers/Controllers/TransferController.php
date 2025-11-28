<?php

namespace App\Features\Transfers\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Transfers\Models\StockTransfer;
use App\Features\Transfers\Repositories\TransferRepository;
use App\Features\Transfers\Requests\StoreTransferRequest;
use App\Features\Transfers\Resources\TransferResource;
use App\Features\Transfers\Services\TransferBroadcaster;
use App\Features\Products\Repositories\ProductRepository;
use App\Features\Products\Services\ProductBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

// Stock moving between branches: sent by one branch, added to stock by the other
class TransferController
{
    public function __construct(
        private TransferRepository $transfers,
        private TransferBroadcaster $live,
        private ProductRepository $products,
        private ProductBroadcaster $catalog,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return TransferResource::collection($this->transfers->visibleTo($request->user()));
    }

    public function store(StoreTransferRequest $request): JsonResponse
    {
        $data = $request->validated();
        $transfer = $this->transfers->create([
            'from_branch_id' => $data['from'],
            'to_branch_id' => $data['to'],
            'category' => $data['category'],
            'product' => $data['product'],
            'med_id' => $data['medId'] ?? null,
            'batch' => $data['batch'],
            'expiry_date' => $data['expiry'] ?? null,
            'qty' => $data['qty'],
            'status' => 'in_transit',
            'sent_by' => $request->user()->id,
        ]);
        $this->live->changed($transfer);
        app(AuditLogger::class)->record('Stock Transfers', 'Stock sent', $transfer->id, "{$transfer->qty} × {$transfer->product} (batch {$transfer->batch}) sent from ".AuditLogger::branchName($transfer->from_branch_id).' to '.AuditLogger::branchName($transfer->to_branch_id).'.', $transfer->from_branch_id);

        return response()->json([
            'message' => "Transfer {$transfer->id} sent: {$transfer->qty} × {$transfer->product}. It reaches the other branch's stock once their Inventory Officer adds it.",
            'transfer' => new TransferResource($this->transfers->withPeople($transfer)),
        ], 201);
    }

    // Receiving branch's Inventory Officer (Add Medicine): the units enter their stock, once
    public function receive(Request $request, StockTransfer $transfer): JsonResponse
    {
        if ($transfer->to_branch_id !== $request->user()->branch_id) {
            abort(403, 'This transfer is for another branch.');
        }
        $sellingPrice = (float) $request->validate(
            ['sellingPrice' => ['required', 'numeric', 'gt:0', 'max:10000000']],
            ['sellingPrice.*' => 'Enter a selling price greater than 0'],
        )['sellingPrice'];

        $received = DB::transaction(function () use ($transfer, $request, $sellingPrice) {
            $locked = $this->transfers->lockForUpdate($transfer);
            if (! $locked->isInTransit()) {
                abort(422, 'This transfer was already added to stock.');
            }

            // The selling price is the product's, at every branch
            $this->products->setPrices($locked->med_id, null, $sellingPrice, $request->user());

            return $this->transfers->withPeople($this->transfers->markReceived($locked, $request->user()));
        });
        $this->live->changed($received);
        $this->catalog->changed();
        app(AuditLogger::class)->record('Stock Transfers', 'Transfer received', $received->id, "{$received->qty} × {$received->product} from ".AuditLogger::branchName($received->from_branch_id)." added as batch {$received->received_batch}, selling at ".AuditLogger::money($sellingPrice).'.', $received->to_branch_id);

        return response()->json([
            'message' => "{$received->qty} × {$received->product} added to stock as batch {$received->received_batch}.",
            'transfer' => new TransferResource($received),
        ]);
    }
}
