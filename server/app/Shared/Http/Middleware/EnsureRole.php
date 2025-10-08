<?php

namespace App\Shared\Http\Middleware;

use App\Shared\Enums\AccountStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets the request through only for active users with one of the given roles.
 * Usage: ->middleware('role:owner') or ->middleware('role:pharmacist,cashier')
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || $user->status !== AccountStatus::Active) {
            abort(403, 'Your account is not active.');
        }

        if (! in_array($user->role->value, $roles, true)) {
            abort(403, 'Your role does not have access to this section.');
        }

        return $next($request);
    }
}
