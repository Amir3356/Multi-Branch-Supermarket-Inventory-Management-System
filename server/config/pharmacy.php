<?php

return [
    // The React app; links in emails (invitations, password resets) open pages there
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    'invitation_expire_hours' => (int) env('INVITATION_EXPIRE_HOURS', 72),
];
