<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'status' => 'ok',
        'platform' => 'Ubuzima+',
        'service' => 'backend-web-entry',
        'message' => 'Ubuzima+ backend is running. Use /api/v1/health for API health checks.',
    ]);
});
