<?php

namespace App\Features\Expenses\Controllers;

use App\Features\Expenses\Models\Expense;
use App\Features\Expenses\Repositories\ExpenseRepository;
use App\Features\Expenses\Requests\StoreExpenseRequest;
use App\Features\Expenses\Resources\ExpenseResource;
use App\Features\Expenses\Services\ExpenseBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

// A branch's expenses, recorded by its Inventory Officer
class ExpenseController
{
    public function __construct(private ExpenseRepository $expenses, private ExpenseBroadcaster $live) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return ExpenseResource::collection($this->expenses->visibleTo($request->user()));
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $expense = $this->expenses->create([
            'branch_id' => $request->user()->branch_id,
            'category' => $data['category'],
            'description' => $data['description'] ?? null,
            'amount' => round((float) $data['amount'], 2),
            'expense_date' => $data['date'],
            'recorded_by' => $request->user()->id,
        ]);
        $this->live->changed($expense->branch_id);

        return response()->json(['message' => "Expense {$expense->id} recorded.", 'expense' => new ExpenseResource($expense)], 201);
    }

    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        if ($expense->branch_id !== $request->user()->branch_id) {
            abort(403, 'This expense belongs to another branch.');
        }
        $this->expenses->delete($expense);
        $this->live->changed($expense->branch_id);

        return response()->json(['message' => "Expense {$expense->id} deleted."]);
    }
}
