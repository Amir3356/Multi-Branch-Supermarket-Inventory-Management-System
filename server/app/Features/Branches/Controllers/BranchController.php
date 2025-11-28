<?php

namespace App\Features\Branches\Controllers;

use App\Features\AuditLogs\Services\AuditLogger;
use App\Features\Branches\Models\Branch;
use App\Features\Branches\Repositories\BranchRepository;
use App\Features\Branches\Requests\BranchRequest;
use App\Features\Branches\Resources\BranchResource;
use App\Features\Branches\Services\BranchBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BranchController
{
    public function __construct(private BranchRepository $branches, private BranchBroadcaster $live) {}

    public function index(): AnonymousResourceCollection
    {
        return BranchResource::collection($this->branches->allWithStaffCount());
    }

    // Owner only, as are update and destroy
    public function store(BranchRequest $request): JsonResponse
    {
        $branch = $this->branches->create($request->validated());
        app(AuditLogger::class)->record('Branches', 'Branch added', $branch->id, "{$branch->name} added at {$branch->location} ({$branch->status}).", $branch->id);

        $this->live->changed('added');

        return response()->json([
            'message' => "{$branch->name} ({$branch->id}) was added.",
            'branch' => new BranchResource($this->branches->withStaffCount($branch)),
        ], 201);
    }

    public function update(BranchRequest $request, Branch $branch): JsonResponse
    {
        $before = $branch->only(['name', 'location', 'status']);
        $this->branches->update($branch, $request->validated());
        $changes = collect($before)->filter(fn ($old, $field) => (string) $old !== (string) $branch->{$field})
            ->map(fn ($old, $field) => "{$field} “{$old}” → “{$branch->{$field}}”")->implode(', ');
        app(AuditLogger::class)->record('Branches', 'Branch updated', $branch->id, "{$branch->name}: ".($changes ?: 'no changes').'.', $branch->id);

        $this->live->changed('updated');

        return response()->json([
            'message' => "{$branch->name} was updated.",
            'branch' => new BranchResource($this->branches->withStaffCount($branch)),
        ]);
    }

    // A branch with staff can't be deleted (their accounts would lose their branch); deactivate it instead
    public function destroy(Branch $branch): JsonResponse
    {
        if ($this->branches->hasStaff($branch)) {
            abort(422, "{$branch->name} can't be deleted because staff accounts are assigned to it. Deactivate it instead.");
        }
        // Procurements, transfers and sales keep pointing at their branch, so its history must stay
        if ($this->branches->hasHistory($branch)) {
            abort(422, "{$branch->name} can't be deleted because it has procurement, transfer or sales records. Deactivate it instead.");
        }

        $this->branches->delete($branch);
        app(AuditLogger::class)->record('Branches', 'Branch deleted', $branch->id, "{$branch->name} ({$branch->location}) was deleted.");
        $this->live->changed('deleted');

        return response()->json(['message' => "{$branch->name} was deleted."]);
    }
}
