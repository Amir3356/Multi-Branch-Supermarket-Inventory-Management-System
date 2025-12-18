<?php

namespace App\Features\Reports\Repositories;

use Illuminate\Support\Facades\DB;

/**
 * Procurement Report: purchase orders placed in a period (by order date): what was spent, with which suppliers, for
 * which branch, and where each order stands (awaiting payment, paid, received, failed).
 */
class ProcurementReportRepository
{
    public function build(ReportPeriod $p): array
    {
        $orders = fn () => $p->timestamps(DB::table('procurements'), 'procurements.created_at', 'procurements.branch_id');
        $paid = fn () => $orders()->where('procurements.status', 'paid');

        // Where each order stands: paid ones split into received (in stock) and still on the way
        $stage = "case when procurements.status = 'paid' and procurements.received_at is not null then 'Received'
                       when procurements.status = 'paid' then 'Paid, awaiting delivery'
                       when procurements.status = 'pending' then 'Awaiting payment'
                       else 'Payment failed' end";

        return [
            'totals' => [
                'orders' => $orders()->count(),
                'spent' => (float) $paid()->sum('total'),
                'paidOrders' => $paid()->count(),
                'unitsBought' => (int) $paid()->sum('qty'),
                'awaitingPayment' => $orders()->where('status', 'pending')->count(),
                'awaitingPaymentAmount' => (float) $orders()->where('status', 'pending')->sum('total'),
                'awaitingDelivery' => $paid()->whereNull('received_at')->count(),
                'failed' => $orders()->where('status', 'failed')->count(),
                'suppliers' => $orders()->distinct()->count('supplier'),
            ],
            'byStage' => collect(['Received', 'Paid, awaiting delivery', 'Awaiting payment', 'Payment failed'])
                ->map(function ($s) use ($orders, $stage) {
                    $row = $orders()->whereRaw("({$stage}) = ?", [$s])->selectRaw('count(*) as orders, coalesce(sum(total), 0) as amount')->first();

                    return ['stage' => $s, 'orders' => (int) $row->orders, 'amount' => (float) $row->amount];
                })->all(),
            'daily' => $paid()->selectRaw($p->localDay('procurements.created_at').' as day, sum(total) as spent, count(*) as orders')
                ->groupBy('day')->orderBy('day')->get()
                ->map(fn ($r) => ['date' => $r->day, 'spent' => (float) $r->spent, 'orders' => (int) $r->orders])->all(),
            'bySupplier' => $orders()->selectRaw("supplier, count(*) as orders, sum(case when status = 'paid' then total else 0 end) as spent, sum(case when status = 'paid' then qty else 0 end) as units")
                ->groupBy('supplier')->orderByDesc('spent')->get()
                ->map(fn ($r) => ['supplier' => $r->supplier, 'orders' => (int) $r->orders, 'spent' => (float) $r->spent, 'units' => (int) $r->units])->all(),
            'byBranch' => $paid()->join('branches', 'branches.id', '=', 'procurements.branch_id')
                ->selectRaw('branches.name as branch, sum(procurements.total) as spent, count(*) as orders')->groupBy('branches.name')->orderByDesc('spent')->get()
                ->map(fn ($r) => ['branch' => $r->branch, 'spent' => (float) $r->spent, 'orders' => (int) $r->orders])->all(),
            'rows' => $orders()->leftJoin('branches', 'branches.id', '=', 'procurements.branch_id')->leftJoin('users', 'users.id', '=', 'procurements.created_by')
                ->orderByDesc('procurements.created_at')->limit(1000)
                ->get(['procurements.id', 'procurements.created_at', 'branches.name as branch', 'procurements.supplier', 'procurements.product', 'procurements.category',
                    'procurements.qty', 'procurements.unit_price', 'procurements.total', 'procurements.status', 'procurements.received_at', 'procurements.batch', 'users.full_name as ordered_by', DB::raw("({$stage}) as stage")])
                ->map(fn ($r) => [
                    'id' => $r->id, 'at' => $p->local($r->created_at), 'branch' => $r->branch, 'supplier' => $r->supplier, 'product' => $r->product,
                    'category' => $r->category, 'qty' => (int) $r->qty, 'unitPrice' => (float) $r->unit_price, 'total' => (float) $r->total,
                    'stage' => $r->stage, 'receivedAt' => $p->local($r->received_at), 'batch' => $r->batch, 'orderedBy' => $r->ordered_by,
                ])->all(),
        ];
    }
}
