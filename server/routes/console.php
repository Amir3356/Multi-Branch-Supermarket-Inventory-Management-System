<?php

// Each feature schedules its own background jobs in app/Features/<Feature>/Routes/console.php.
// They run while `php artisan schedule:work` (or a cron entry for `schedule:run`) is running.
foreach (glob(app_path('Features/*/Routes/console.php')) as $featureSchedule) {
    require $featureSchedule;
}
