<?php

namespace App\Shared\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets a change through only while the signed-in staff member's branch is active: a deactivated branch is closed, so
 * nothing new is recorded there. Usage: ->middleware('branch.active:record expenses'). Those who cover every branch
 * have none, and pass.
 */
class EnsureActiveBranch
{
    public function handle(Request $request, Closure $next, string $action = 'make changes'): Response
    {
        $branchId = $request->user()?->branch_id;
        $branch = $branchId ? DB::table('branches')->where('id', $branchId)->first(['name', 'status']) : null;

        if ($branch && $branch->status !== 'active') {
            abort(422, "{$branch->name} is inactive, so it can't {$action}. Ask the Owner to activate it first.");
        }

        return $next($request);
    }
}
