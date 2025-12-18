<?php

namespace App\Features\Reports\Controllers;

use App\Features\Reports\Repositories\FinancialReportRepository;
use App\Features\Reports\Repositories\InventoryReportRepository;
use App\Features\Reports\Repositories\ProcurementReportRepository;
use App\Features\Reports\Repositories\ReportPeriod;
use App\Features\Reports\Repositories\SalesReportRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// The Owner's reports under Reports: each for a period (the pharmacy's calendar days) and every branch or one. Read only.
class ReportController
{
    public function sales(Request $request, SalesReportRepository $report): JsonResponse
    {
        return $this->respond($request, fn (ReportPeriod $p) => $report->build($p));
    }

    public function inventory(Request $request, InventoryReportRepository $report): JsonResponse
    {
        return $this->respond($request, fn (ReportPeriod $p) => $report->build($p));
    }

    public function financial(Request $request, FinancialReportRepository $report): JsonResponse
    {
        return $this->respond($request, fn (ReportPeriod $p) => $report->build($p));
    }

    public function procurement(Request $request, ProcurementReportRepository $report): JsonResponse
    {
        return $this->respond($request, fn (ReportPeriod $p) => $report->build($p));
    }

    private function respond(Request $request, callable $build): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'branchId' => ['nullable', 'string', 'exists:branches,id'],
        ], ['to.after_or_equal' => 'The end date must be on or after the start date.']);
        $period = new ReportPeriod($data['from'], $data['to'], $data['branchId'] ?? null);

        return response()->json(['data' => ['from' => $period->from, 'to' => $period->to, 'branchId' => $period->branchId] + $build($period)]);
    }
}
