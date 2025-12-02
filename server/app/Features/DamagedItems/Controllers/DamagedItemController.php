<?php

namespace App\Features\DamagedItems\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\DamagedItems\Repositories\DamagedItemRepository;
use App\Features\DamagedItems\Requests\StoreDamagedItemRequest;
use App\Features\DamagedItems\Resources\DamagedItemResource;
use App\Features\DamagedItems\Services\DamagedItemBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

// Damaged stock: the Inventory Officer writes it off at their branch; every screen's stock follows
class DamagedItemController
{
    public function __construct(private DamagedItemRepository $damaged, private DamagedItemBroadcaster $live) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return DamagedItemResource::collection($this->damaged->visibleTo($request->user()));
    }

    public function store(StoreDamagedItemRequest $request): JsonResponse
    {
        $data = $request->validated();
        // Worked out here, not taken from the client, so the Owner's net profit can rely on it
        $lossValue = round($data['qty'] * $this->damaged->unitCost($data['medId'] ?? null), 2);
        $item = $this->damaged->create([
            'branch_id' => $request->user()->branch_id,
            'med_id' => $data['medId'] ?? null,
            'product' => $data['product'],
            'category' => $data['category'],
            'batch' => $data['batch'],
            'qty' => $data['qty'],
            'reason' => $data['reason'],
            'loss_value' => $lossValue,
            'damage_date' => now(config('pharmacy.timezone'))->toDateString(),
            'recorded_by' => $request->user()->id,
        ]);
        $this->live->recorded($item);
        app(AuditLogger::class)->record('Damaged Items', 'Damage recorded', $item->id, "{$item->qty} × {$item->product} (batch {$item->batch}) written off: {$item->reason}. Loss ".AuditLogger::money($item->loss_value).'.', $item->branch_id);

        return response()->json(['message' => "{$item->id} recorded.", 'damagedItem' => new DamagedItemResource($item)], 201);
    }
}
