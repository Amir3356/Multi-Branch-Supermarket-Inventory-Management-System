<?php

return [
    // The React app; links in emails (invitations, password resets) open pages there
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'invitation_expire_hours' => (int) env('INVITATION_EXPIRE_HOURS', 72),

    // Behind a reverse proxy or load balancer: its IPs (comma-separated) or "*", so Session Monitoring shows real visitor IPs
    'trusted_proxies' => env('TRUSTED_PROXIES'),

    // Session Monitoring's Location column: look up each public IP once via ipwho.is (set false to never send IPs out)
    'ip_location_lookup' => (bool) env('IP_LOCATION_LOOKUP', true),

    // Session Monitoring: a session with no activity for this many minutes shows as Idle.
    // At least 5, because staff browsers check in every 2 minutes while in use.
    'session_idle_minutes' => $idle = max(5, (int) env('SESSION_IDLE_MINUTES', 15)),

    // Signed out automatically after this many minutes without activity; 0 = never.
    // Never shorter than the idle time, so a session always shows as Idle before it is signed out.
    'session_timeout_minutes' => (int) env('SESSION_TIMEOUT_MINUTES', 30) > 0 ? max($idle, (int) env('SESSION_TIMEOUT_MINUTES', 30)) : 0,
];
