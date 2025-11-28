<?php

namespace App\Features\AuditLogs\Controllers;

use App\Features\AuditLogs\Models\AuditLog;
use App\Features\AuditLogs\Repositories\AuditLogRepository;
use App\Features\AuditLogs\Resources\AuditLogResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

// The Owner's Audit Logs page: read only, newest first, filtered and paged on the server
class AuditLogController
{
    private const PER_PAGE = 25;

    public function __construct(private AuditLogRepository $logs) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'module' => ['nullable', Rule::in(AuditLog::MODULES)],
            'branchId' => ['nullable', 'string', 'max:20'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ], ['to.after_or_equal' => 'The end date must be on or after the start date.']);

        return AuditLogResource::collection($this->logs->search($filters, self::PER_PAGE))
            ->additional(['modules' => AuditLog::MODULES]);
    }
}
