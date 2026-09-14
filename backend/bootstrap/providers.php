<?php

use App\Providers\AppServiceProvider;

return [
    App\Providers\TestSqliteCompatibilityServiceProvider::class,
    AppServiceProvider::class,
    App\Providers\LiveBusinessDateServiceProvider::class,
];
