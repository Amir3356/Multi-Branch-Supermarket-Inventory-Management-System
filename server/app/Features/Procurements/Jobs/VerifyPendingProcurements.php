<?php

namespace App\Features\Procurements\Jobs;

use App\Features\Procurements\Repositories\ProcurementRepository;
use App\Features\Procurements\Services\ProcurementPayments;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

// Scheduled: checks pending payments with Chapa, for when its callback never arrives (e.g. a server
// Chapa can't reach) and the officer closed the page before returning from checkout
class VerifyPendingProcurements implements ShouldQueue
{
    use Queueable;

    public function handle(ProcurementRepository $procurements, ProcurementPayments $payments): void
    {
        // Give the officer a few minutes to pay first; after a day an unpaid checkout has lapsed
        foreach ($procurements->pendingToVerify(minMinutes: 5, maxHours: 24) as $procurement) {
            try {
                $payments->sync($procurement);
            } catch (Throwable $e) {
                // One failed check (Chapa unreachable) shouldn't stop the others; it's retried next run
                Log::warning('Procurement payment check failed', ['procurement' => $procurement->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
