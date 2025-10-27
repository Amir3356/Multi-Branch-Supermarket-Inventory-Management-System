<?php

namespace App\Features\ReturnRequests\Controllers;

use App\Features\ReturnRequests\Models\ReturnRequest;
use App\Features\ReturnRequests\Repositories\ReturnRequestRepository;
use App\Features\ReturnRequests\Requests\StoreReturnRequestRequest;
use App\Features\ReturnRequests\Resources\ReturnRequestResource;
use App\Features\ReturnRequests\Services\ReturnRequestBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

// Inventory Officer → Procurement Officer requests to send stock back to the supplier
class ReturnRequestController
{
    public function __construct(private ReturnRequestRepository $requests, private ReturnRequestBroadcaster $live) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return ReturnRequestResource::collection($this->requests->visibleTo($request->user()));
    }

    // Inventory Officer only
    public function store(StoreReturnRequestRequest $request): JsonResponse
    {
        $procurement = $request->procurement();
        $returnRequest = $this->requests->create([
            'procurement_id' => $procurement->id,
            'branch_id' => $procurement->branch_id,
            'requested_by' => $request->user()->id,
            'qty' => $request->validated('qty'),
            'reason' => $request->validated('reason'),
            'note' => $request->validated('note'),
            'status' => 'pending',
        ]);
        $this->live->changed($this->requests->withDetails($returnRequest));

        return response()->json([
            'message' => "Return request sent: {$returnRequest->qty} × {$procurement->product} (batch {$procurement->id}). The Procurement Officer will review it.",
            'request' => new ReturnRequestResource($this->requests->withDetails($returnRequest)),
        ], 201);
    }

    // Procurement Officer only: the client records the supplier return once this succeeds
    public function approve(Request $request, ReturnRequest $returnRequest): JsonResponse
    {
        $handled = $this->handle($request, $returnRequest, 'approved', null);

        return response()->json([
            'message' => 'Return request approved.',
            'request' => new ReturnRequestResource($handled),
        ]);
    }

    // Procurement Officer only
    public function reject(Request $request, ReturnRequest $returnRequest): JsonResponse
    {
        $data = $request->validate(['responseNote' => ['required', 'string', 'max:500']], [
            'responseNote.required' => 'Tell the Inventory Officer why the request was rejected.',
        ]);
        $handled = $this->handle($request, $returnRequest, 'rejected', $data['responseNote']);

        return response()->json([
            'message' => 'Return request rejected.',
            'request' => new ReturnRequestResource($handled),
        ]);
    }

    // Procurement Officer only: the supplier sent good units in place of an approved return. They go back into the
    // same batch at no cost (no new procurement or payment) and settle that much of the supplier's credit.
    public function replace(Request $request, ReturnRequest $returnRequest): JsonResponse
    {
        $data = $request->validate([
            'qty' => ['required', 'integer', 'min:1', "max:{$returnRequest->qty}"],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'qty.max' => "At most {$returnRequest->qty} units were returned, so at most {$returnRequest->qty} can be replaced.",
        ]);
        $this->ensureSameBranch($request, $returnRequest);

        $replaced = DB::transaction(function () use ($request, $returnRequest, $data) {
            $locked = $this->requests->lockForUpdate($returnRequest);
            if (! $locked->awaitsReplacement()) {
                abort(422, match (true) {
                    $locked->replaced_qty !== null => 'A replacement was already received for this return.',
                    $locked->isExtraQuantity() => "Extra units were never ordered, so they aren't replaced.",
                    default => 'Only an approved return can be replaced.',
                });
            }

            return $this->requests->withDetails($this->requests->markReplaced($locked, (int) $data['qty'], $request->user(), $data['note'] ?? null));
        });
        $this->live->changed($replaced);

        return response()->json([
            'message' => "{$replaced->replaced_qty} × {$replaced->procurement?->product} received from {$replaced->procurement?->supplier} back into batch {$replaced->procurement_id}.",
            'request' => new ReturnRequestResource($replaced),
        ]);
    }

    private function ensureSameBranch(Request $request, ReturnRequest $returnRequest): void
    {
        if ($returnRequest->branch_id !== $request->user()->branch_id) {
            abort(403, 'This request is for another branch.');
        }
    }

    private function handle(Request $request, ReturnRequest $returnRequest, string $status, ?string $note): ReturnRequest
    {
        $this->ensureSameBranch($request, $returnRequest);

        $handled = DB::transaction(function () use ($request, $returnRequest, $status, $note) {
            $locked = $this->requests->lockForUpdate($returnRequest);
            if (! $locked->isPending()) {
                abort(422, 'This request has already been handled.');
            }

            return $this->requests->withDetails($this->requests->markHandled($locked, $status, $request->user(), $note));
        });
        $this->live->changed($handled);

        return $handled;
    }
}
