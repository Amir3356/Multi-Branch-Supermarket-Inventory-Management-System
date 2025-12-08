<?php

namespace App\Features\Transfers\Repositories;

use App\Features\Accounts\Models\User;
use App\Features\Stock\Repositories\StockRepository;
use App\Features\Transfers\Models\StockTransfer;
use App\Shared\Services\BatchNumbers;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for stock transfers
class TransferRepository
{
    private const RELATIONS = ['sender', 'receiver'];

    public function __construct(private BatchNumbers $batchNumbers, private StockRepository $stock) {}

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

    /**
     * Sent: the units leave the sending branch's batch in the same transaction, or the transfer isn't saved. The
     * expiry date travels with the batch from the server's stock, not from the screen.
     */
    public function create(array $attributes): StockTransfer
    {
        return DB::transaction(function () use ($attributes) {
            $batch = $this->stock->take($attributes['from_branch_id'], $attributes['product'], $attributes['batch'], (int) $attributes['qty'], expiredAction: 'sent');

            return StockTransfer::create(['expiry_date' => $batch->expiry_date?->toDateString()] + $attributes + ['id' => StockTransfer::nextId()]);
        });
    }

    public function lockForUpdate(StockTransfer $transfer): StockTransfer
    {
        return StockTransfer::whereKey($transfer->getKey())->lockForUpdate()->first();
    }

    /** Added to the receiving branch's stock under a new generated batch number. Call inside the receiving transaction. */
    public function markReceived(StockTransfer $transfer, User $by): StockTransfer
    {
        $transfer->update(['status' => 'received', 'received_by' => $by->id, 'received_at' => now(), 'received_batch' => $this->batchNumbers->next()]);
        $this->stock->add($transfer->to_branch_id, $transfer->product, $transfer->category, $transfer->med_id, $transfer->received_batch, $transfer->expiry_date?->toDateString(), $transfer->qty, $transfer->received_at);

        return $transfer;
    }

    public function withPeople(StockTransfer $transfer): StockTransfer
    {
        return $transfer->load(self::RELATIONS);
    }
}
