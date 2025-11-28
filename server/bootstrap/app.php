<?php

use App\Shared\Http\Middleware\EnsureRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // WebSockets (Reverb): private channels authorize at /api/broadcasting/auth with the Sanctum token
    ->withBroadcasting(__DIR__.'/../routes/channels.php', ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']])
    ->withCommands(glob(__DIR__.'/../app/Features/*/Console', GLOB_ONLYDIR))
    ->withMiddleware(function (Middleware $middleware): void {
        // RBAC: ->middleware('role:owner') or 'role:pharmacist,cashier'
        $middleware->alias(['role' => EnsureRole::class]);
        // Check the role before looking up {record} in the URL, so a role without access gets 403 for every
        // id, and can't learn which ids exist from 404s
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: EnsureRole::class);
        // There's no server-rendered login page: guests get a JSON 401, never a redirect
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
