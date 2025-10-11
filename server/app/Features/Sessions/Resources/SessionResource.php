<?php

namespace App\Features\Sessions\Resources;

use App\Features\Sessions\Services\SessionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $this->tokenable;
        $expired = app(SessionService::class)->isExpired($this->resource);

        return [
            'id' => $this->id,
            'userId' => $user->id,
            'fullName' => $user->full_name,
            'email' => $user->email,
            'role' => $user->role->value,
            'roleLabel' => $user->role->label(),
            'branchId' => $user->isOwner() ? 'all' : $user->branch_id,
            'device' => SessionService::describeDevice($this->name),
            'ip' => $this->ip_address,
            'location' => $this->location,
            'signedInAt' => $this->created_at->toIso8601String(),
            'lastActiveAt' => ($this->last_used_at ?? $this->created_at)->toIso8601String(),
            'status' => $this->ended_at || $expired ? 'Ended' : 'Open',
            'endedAt' => ($this->ended_at ?? ($expired ? $this->created_at->addMinutes(config('sanctum.expiration')) : null))?->toIso8601String(),
            'endedReason' => $this->ended_reason ?? ($expired ? 'Expired' : null),
            // The Owner's own browser
            'current' => $this->id === $request->user()->currentAccessToken()->id,
        ];
    }
}
