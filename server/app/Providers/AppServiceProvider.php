<?php

namespace App\Providers;

use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
    }
}
