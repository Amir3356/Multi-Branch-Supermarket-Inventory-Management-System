<?php

// Each feature owns its WebSocket channels in app/Features/<Feature>/Routes/channels.php.
// Clients authorize at POST /api/broadcasting/auth with their bearer token.
foreach (glob(app_path('Features/*/Routes/channels.php')) as $featureChannels) {
    require $featureChannels;
}
