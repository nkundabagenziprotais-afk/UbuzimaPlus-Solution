<?php

use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PlatformStatusController;
use App\Http\Controllers\Api\V1\SolutionController;
use App\Http\Controllers\Api\V1\TenantPublicStatusController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthController::class);
    Route::get('/platform/status', PlatformStatusController::class);
    Route::get('/solutions', [SolutionController::class, 'index']);
    Route::get('/tenants/{slug}/public-status', [TenantPublicStatusController::class, 'show']);
});
