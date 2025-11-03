<?php

namespace App\Features\Transfers\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Transfers\Models\StockTransfer;
use Illuminate\Support\Collection;
use App\Shared\Services\BatchNumbers;
use Illuminate\Support\Facades\DB;

// Every database read and write for stock transfers
class TransferRepository
{
    private const RELATIONS = ['sender', 'receiver'];

    public function __construct(private BatchNumbers $batchNumbers) {}

    /** Newest first: every branch for those who cover all branches, otherwise what the user's branch sent or received */
    public function visibleTo(User $user): Collection
    {
        return StockTransfer::with(self::RELATIONS)
            ->when(! $user->coversAllBranches(), fn ($query) => $query->where(fn ($q) => $q
                ->where('from_branch_id', $user->branch_id)
                ->orWhere('to_branch_id', $user->branch_id)))
            ->latest()
            ->get();
    }

    public function create(array $attributes): StockTransfer
    {
        return DB::transaction(fn () => StockTransfer::create($attributes + ['id' => StockTransfer::nextId()]));
    }

    public function lockForUpdate(StockTransfer $transfer): StockTransfer
    {
        return StockTransfer::whereKey($transfer->getKey())->lockForUpdate()->first();
    }

    /** Added to the receiving branch's stock under a new generated batch number */
    public function markReceived(StockTransfer $transfer, User $by): StockTransfer
    {
        $transfer->update(['status' => 'received', 'received_by' => $by->id, 'received_at' => now(), 'received_batch' => $this->batchNumbers->next()]);

        return $transfer;
    }

    public function withPeople(StockTransfer $transfer): StockTransfer
    {
        return $transfer->load(self::RELATIONS);
    }
}
