<?php

namespace App\Features\Accounts\Resources;

use App\Shared\Enums\AccountStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fullName' => $this->full_name,
            'email' => $this->email,
            'role' => $this->role->value,
            'roleLabel' => $this->role->label(),
            // The Owner covers every branch
            'branchId' => $this->isOwner() ? 'all' : $this->branch_id,
            'branchName' => $this->isOwner() ? 'All Branches' : $this->branch?->name,
            'status' => $this->status->label(),
            'invitationExpired' => $this->when(
                $this->status === AccountStatus::Invited && $this->relationLoaded('invitation'),
                fn () => ! $this->invitation || $this->invitation->isExpired(),
            ),
            'lastLoginAt' => $this->last_login_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toDateString(),
        ];
    }
}
