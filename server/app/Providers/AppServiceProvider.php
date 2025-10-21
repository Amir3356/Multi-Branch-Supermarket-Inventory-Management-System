<?php

namespace App\Providers;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use App\Features\Procurements\Services\ChapaClient;
use App\Features\Procurements\Services\FakeChapaClient;
use App\Features\Sessions\Models\SessionToken;
use App\Features\Sessions\Services\SessionService;
use Laravel\Sanctum\Events\TokenAuthenticated;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One per request, so several session changes in a request send a single live update
        $this->app->scoped(SessionService::class);

        // CHAPA_MODE=fake: a pretend checkout on this server, for local development without working Chapa keys
        $this->app->bind(ChapaClient::class, fn () => config('services.chapa.mode') === 'fake' ? new FakeChapaClient : new ChapaClient);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Each feature keeps its own Blade views: app/Features/Accounts/views -> view('accounts::...')
        foreach (glob(app_path('Features/*/views'), GLOB_ONLYDIR) as $path) {
            View::addNamespace(strtolower(basename(dirname($path))), $path);
        }

        // Tokens are sessions (Sessions feature); one ended by sign-out, the Owner, deactivation or a password reset no longer authenticates
        Sanctum::usePersonalAccessTokenModel(SessionToken::class);
        // ...and one unused for longer than SESSION_TIMEOUT_MINUTES is signed out instead of let through
        Sanctum::authenticateAccessTokensUsing(fn (SessionToken $token, bool $isValid) => $isValid
            && $token->ended_at === null
            && ! app(SessionService::class)->expireIfInactive($token));
        Route::model('session', SessionToken::class);

        if ($proxies = config('pharmacy.trusted_proxies')) {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }

        // Session Monitoring shows the address (and location) each session was last used from
        Event::listen(fn (TokenAuthenticated $event) => app(SessionService::class)->recordActivity($event->token, request()->ip()));
    }
}
