<?php

return [
    // The React app; links in emails (invitations, password resets) open pages there
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'invitation_expire_hours' => (int) env('INVITATION_EXPIRE_HOURS', 72),

    // Behind a reverse proxy or load balancer: its IPs (comma-separated) or "*", so Session Monitoring shows real visitor IPs
    'trusted_proxies' => env('TRUSTED_PROXIES'),

    // Session Monitoring's Location column: look up each public IP once via ipwho.is (set false to never send IPs out)
    'ip_location_lookup' => (bool) env('IP_LOCATION_LOOKUP', true),

    // Ask each browser for its location after sign-in, for a precise place such as "Addis Ababa, Bole, Ethiopia"
    // (named via OpenStreetMap). If the person blocks it, the IP-based city is used. false = never ask.
    'device_location' => (bool) env('DEVICE_LOCATION', true),

    // Access reviews: an active account with no sign-in for this many days is flagged as dormant
    'access_review_dormant_days' => (int) env('ACCESS_REVIEW_DORMANT_DAYS', 90),
    // ...and an invitation not accepted after this many days as stale
    'access_review_stale_invitation_days' => (int) env('ACCESS_REVIEW_STALE_INVITATION_DAYS', 30),

    // Session Monitoring: a session with no activity for this many minutes shows as Idle.
    // At least 5, because staff browsers check in every 2 minutes while in use.
    'session_idle_minutes' => $idle = max(5, (int) env('SESSION_IDLE_MINUTES', 15)),

    // Signed out automatically after this many minutes without activity; 0 = never.
    // Never shorter than the idle time, so a session always shows as Idle before it is signed out.
    'session_timeout_minutes' => (int) env('SESSION_TIMEOUT_MINUTES', 30) > 0 ? max($idle, (int) env('SESSION_TIMEOUT_MINUTES', 30)) : 0,
];
