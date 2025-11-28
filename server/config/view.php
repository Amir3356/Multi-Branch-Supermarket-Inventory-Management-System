<?php

return [

    // No shared resources/views folder: every view lives in its feature (app/Features/<Feature>/views) and is loaded
    // by AppServiceProvider under the feature's namespace, e.g. accounts::mail.invitation
    'paths' => [],

    'compiled' => env('VIEW_COMPILED_PATH', realpath(storage_path('framework/views'))),

];
