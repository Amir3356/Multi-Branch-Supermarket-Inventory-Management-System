<?php

namespace App\Features\Branches\Controllers;

use App\Features\Branches\Models\Branch;
use App\Features\Branches\Requests\BranchRequest;
use App\Features\Branches\Resources\BranchResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class BranchController
{
    public function index(): AnonymousResourceCollection
    {
        return BranchResource::collection(Branch::withCount('staff')->orderBy('id')->get());
    }

    // Owner only, as are update and destroy
    public function store(BranchRequest $request): JsonResponse
    {
        $branch = DB::transaction(fn () => Branch::create($request->validated() + [
            'id' => Branch::nextId(),
            'status' => 'active',
        ]));

        return response()->json([
            'message' => "{$branch->name} ({$branch->id}) was added.",
            'branch' => new BranchResource($branch->loadCount('staff')),
        ], 201);
    }

    public function update(BranchRequest $request, Branch $branch): JsonResponse
    {
        $branch->update($request->validated());

        return response()->json([
            'message' => "{$branch->name} was updated.",
            'branch' => new BranchResource($branch->loadCount('staff')),
        ]);
    }

    // A branch with staff can't be deleted (their accounts would lose their branch); deactivate it instead
    public function destroy(Branch $branch): JsonResponse
    {
        if ($branch->staff()->exists()) {
            abort(422, "{$branch->name} can't be deleted because staff accounts are assigned to it. Deactivate it instead.");
        }

        $branch->delete();

        return response()->json(['message' => "{$branch->name} was deleted."]);
    }
}
