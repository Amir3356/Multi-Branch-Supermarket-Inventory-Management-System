<?php

// Each feature owns its endpoints in app/Features/<Feature>/routes.php.
// Everything here is served under /api.
foreach (glob(app_path('Features/*/routes.php')) as $featureRoutes) {
    require $featureRoutes;
}
