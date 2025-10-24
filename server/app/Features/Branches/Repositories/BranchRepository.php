<?php

namespace App\Features\Branches\Repositories;

use App\Features\Branches\Models\Branch;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

// Every database read and write for branches
class BranchRepository
{
    /** All branches with how many staff accounts each has, oldest first. */
    public function allWithStaffCount(): Collection
    {
        return Branch::withCount('staff')->orderBy('id')->get();
    }

    /** A new Active branch with the next free id (BR-01, BR-02, …). */
    public function create(array $attributes): Branch
    {
        return DB::transaction(fn () => Branch::create($attributes + [
            'id' => Branch::nextId(),
            'status' => 'active',
        ]));
    }

    public function update(Branch $branch, array $attributes): Branch
    {
        $branch->update($attributes);

        return $branch;
    }

    public function delete(Branch $branch): void
    {
        $branch->delete();
    }

    public function hasStaff(Branch $branch): bool
    {
        return $branch->staff()->exists();
    }

    // PostgreSQL compares text case-sensitively, so "Bole Branch" and "bole branch" need an explicit check
    public function nameTaken(string $name, ?Branch $ignore = null): bool
    {
        return Branch::whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->getKey()))
            ->exists();
    }

    public function withStaffCount(Branch $branch): Branch
    {
        return $branch->loadCount('staff');
    }
}
