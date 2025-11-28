<?php

namespace App\Features\Dashboard\Controllers;

use App\Features\Dashboard\Repositories\OwnerDashboardRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// The Owner's dashboard: sales, purchases, expenses and profit for a period, for every branch or one
class OwnerDashboardController
{
    public function __construct(private OwnerDashboardRepository $dashboard) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'branchId' => ['nullable', 'string', 'exists:branches,id'],
        ], ['to.after_or_equal' => 'The end date must be on or after the start date.']);

        return response()->json(['data' => $this->dashboard->summary($data['from'], $data['to'], $data['branchId'] ?? null)]);
    }
}
