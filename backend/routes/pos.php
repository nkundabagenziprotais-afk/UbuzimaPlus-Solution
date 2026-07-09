<?php

use App\Http\Controllers\Api\V1\PharmaCo360\PosSessionController;
use Illuminate\Support\Facades\Route;

Route::middleware([
    'auth:sanctum',
    'permission:pharmaco.sales.manage',
    'tenant.module:pharmaco.sales',
])->prefix('v1/pharmaco/pos-sessions')->group(function (): void {
    Route::get('/current', [PosSessionController::class, 'current']);
    Route::post('/open', [PosSessionController::class, 'open']);
    Route::get('/transactions', [PosSessionController::class, 'transactions']);
    Route::post('/close', [PosSessionController::class, 'close']);
});
