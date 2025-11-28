<?php

use App\Features\AuditLogs\Controllers\AuditLogController;
use Illuminate\Support\Facades\Route;

// Audit Logs (Owner only, read only: entries are never edited or deleted)
Route::middleware(['auth:sanctum', 'role:owner'])->get('/audit-logs', [AuditLogController::class, 'index']);
