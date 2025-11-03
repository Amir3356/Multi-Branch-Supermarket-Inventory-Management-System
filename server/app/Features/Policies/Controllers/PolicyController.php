<?php

namespace App\Features\Policies\Controllers;

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
        $policy = $this->policies->update([
            'default_min_stock' => $request->validated('defaultMinStock'),
            'expiry_warning_days' => $request->validated('expiryWarningDays'),
        ], $request->user());
        $this->live->changed($policy);

        return response()->json(['message' => 'Policy saved for every product at all branches.', 'policy' => new PolicyResource($policy)]);
    }
}
