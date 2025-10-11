<?php

// Each feature owns its WebSocket channels in app/Features/<Feature>/channels.php.
// Clients authorize at POST /api/broadcasting/auth with their bearer token.
foreach (glob(app_path('Features/*/channels.php')) as $featureChannels) {
    require $featureChannels;
}
