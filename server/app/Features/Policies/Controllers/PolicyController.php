<?php

namespace App\Features\Policies\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Policies\Repositories\PolicyRepository;
use App\Features\Policies\Requests\UpdatePolicyRequest;
use App\Features\Policies\Resources\PolicyResource;
use App\Features\Policies\Services\PolicyBroadcaster;
use Illuminate\Http\JsonResponse;

// The pharmacy's policy: every signed-in user reads it (stock statuses depend on it); the Inventory Officer changes it
class PolicyController
{
    public function __construct(private PolicyRepository $policies, private PolicyBroadcaster $live) {}

    public function show(): PolicyResource
    {
        return new PolicyResource($this->policies->current());
    }

    public function update(UpdatePolicyRequest $request): JsonResponse
    {
        $before = $this->policies->current()->only(['default_min_stock', 'expiry_warning_days']);
        $policy = $this->policies->update([
            'default_min_stock' => $request->validated('defaultMinStock'),
            'expiry_warning_days' => $request->validated('expiryWarningDays'),
        ], $request->user());
        $this->live->changed($policy);
        $changes = array_filter([
            $before['default_min_stock'] != $policy->default_min_stock ? "minimum stock {$before['default_min_stock']} → {$policy->default_min_stock} units" : null,
            $before['expiry_warning_days'] != $policy->expiry_warning_days ? "expiring-soon window {$before['expiry_warning_days']} → {$policy->expiry_warning_days} days" : null,
        ]);
        app(AuditLogger::class)->record('Policy', 'Policy updated', null, ($changes ? ucfirst(implode(', ', $changes)) : 'Saved with no changes').' (every product at all branches).', $request->user()->branch_id);

        return response()->json(['message' => 'Policy saved for every product at all branches.', 'policy' => new PolicyResource($policy)]);
    }
}
