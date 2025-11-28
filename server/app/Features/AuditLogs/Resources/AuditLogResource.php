<?php

namespace App\Features\AuditLogs\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'occurredAt' => $this->occurred_at->toIso8601String(),
            'userName' => $this->user_name,
            'userRole' => $this->user_role,
            'branchId' => $this->branch_id,
            'branchName' => $this->branch_name,
            'module' => $this->module,
            'action' => $this->action,
            'recordId' => $this->record_id,
            'description' => $this->description,
            'ipAddress' => $this->ip_address,
            'device' => $this->device,
        ];
    }
}
