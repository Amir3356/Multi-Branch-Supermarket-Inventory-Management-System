<?php

namespace App\Features\ReturnRequests\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\ReturnRequests\Models\ReturnRequest;
use Illuminate\Support\Collection;

// Every database read and write for return requests
class ReturnRequestRepository
{
    private const RELATIONS = ['procurement', 'requester', 'handler', 'replacer'];

    /** Newest first: every branch for the Owner, otherwise the user's own branch. */
    public function visibleTo(User $user): Collection
    {
        return ReturnRequest::with(self::RELATIONS)
            ->when(! $user->isOwner(), fn ($query) => $query->where('branch_id', $user->branch_id))
            ->latest('id')
            ->get();
    }

    /** Units of a procurement asked for or sent back (pending + approved requests), less what the supplier replaced. */
    public function claimedQty(string $procurementId): int
    {
        $requests = ReturnRequest::where('procurement_id', $procurementId)->whereIn('status', ['pending', 'approved']);

        return (int) $requests->clone()->sum('qty') - (int) $requests->clone()->sum('replaced_qty');
    }

    public function create(array $attributes): ReturnRequest
    {
        return ReturnRequest::create($attributes);
    }

    /** Re-reads the row and locks it until the surrounding transaction ends. */
    public function lockForUpdate(ReturnRequest $request): ReturnRequest
    {
        return ReturnRequest::whereKey($request->getKey())->lockForUpdate()->first();
    }

    public function markHandled(ReturnRequest $request, string $status, User $by, ?string $note): ReturnRequest
    {
        $request->update(['status' => $status, 'handled_by' => $by->id, 'handled_at' => now(), 'response_note' => $note]);

        return $request;
    }

    public function markReplaced(ReturnRequest $request, int $qty, User $by, ?string $note): ReturnRequest
    {
        $request->update(['replaced_qty' => $qty, 'replaced_by' => $by->id, 'replaced_at' => now(), 'replacement_note' => $note]);

        return $request;
    }

    public function withDetails(ReturnRequest $request): ReturnRequest
    {
        return $request->load(self::RELATIONS);
    }
}
