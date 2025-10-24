<?php

// Each feature owns its endpoints in app/Features/<Feature>/Routes/api.php.
// Everything here is served under /api.
foreach (glob(app_path('Features/*/Routes/api.php')) as $featureRoutes) {
    require $featureRoutes;
}
