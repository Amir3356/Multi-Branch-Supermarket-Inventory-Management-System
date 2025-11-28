<?php

namespace App\Features\AuditLogs\Services;

use App\Features\Accounts\Models\User;
use App\Features\AuditLogs\Events\AuditLogRecorded;
use App\Features\AuditLogs\Repositories\AuditLogRepository;
use App\Features\Branches\Models\Branch;
use App\Features\Sessions\Services\SessionService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Records an action in the audit log: who (the signed-in user, unless another is given), from which IP and device, on
 * which branch, and what happened. Features call it right after the action succeeds. A failure to write the log is
 * reported but never undoes or blocks the action itself.
 */
class AuditLogger
{
    private bool $announced = false;

    public function __construct(private AuditLogRepository $logs) {}

    public function record(string $module, string $action, ?string $recordId, string $description, ?string $branchId = null, ?User $actor = null, ?string $actorName = null): void
    {
        try {
            $request = request();
            $actor ??= $request->user();
            $this->logs->create([
                'occurred_at' => now(),
                'user_id' => $actor?->id,
                'user_name' => $actor?->full_name ?? $actorName,
                // Payments Chapa confirms on its own (callback, scheduled check) are the system's, not a person's
                'user_role' => $actor?->role?->label() ?? ($actorName === 'Chapa' ? 'System' : null),
                'branch_id' => $branchId,
                'branch_name' => $branchId ? self::branchName($branchId) : null,
                'module' => $module,
                'action' => $action,
                'record_id' => $recordId,
                'description' => Str::limit($description, 2000),
                'ip_address' => $request->ip(),
                'device' => $request->userAgent() ? SessionService::describeDevice($request->userAgent()) : null,
            ]);
            $this->announce();
        } catch (Throwable $e) {
            Log::error('Audit log not written', ['module' => $module, 'action' => $action, 'record' => $recordId, 'error' => $e->getMessage()]);
        }
    }

    /** A branch's name for descriptions (its id if it no longer exists) */
    public static function branchName(?string $branchId): ?string
    {
        return $branchId ? (Branch::whereKey($branchId)->value('name') ?? $branchId) : null;
    }

    /** "ETB 1,234.50" for descriptions */
    public static function money(float|string|null $amount, string $currency = 'ETB'): string
    {
        return $currency.' '.number_format((float) $amount, 2);
    }

    // One live update per request, after the response, so a stopped Reverb server never slows or breaks the action
    private function announce(): void
    {
        if ($this->announced) {
            return;
        }
        $this->announced = true;
        dispatch(function () {
            try {
                broadcast(new AuditLogRecorded);
            } catch (Throwable $e) {
                Log::warning('Live audit log update not sent', ['error' => $e->getMessage()]);
            }
        })->afterResponse();
    }
}
