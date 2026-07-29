<?php

use App\Http\Controllers\Api\V1\PharmaCo360\AccountingReadModelController;
use Illuminate\Support\Facades\Route;


Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
    'App\\Http\\Middleware\\EnsureAnyPermission:finance.dashboard.view,finance.journal.view,finance.reports.view,reports.finance.view',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::get('/overview', [AccountingReadModelController::class, 'overview']);
        Route::get('/journal-register', [AccountingReadModelController::class, 'journalRegister']);
        Route::get('/general-ledger', [AccountingReadModelController::class, 'ledger']);
        Route::get('/trial-balance', [AccountingReadModelController::class, 'trialBalance']);
        Route::get('/chart-of-accounts', [AccountingReadModelController::class, 'chartOfAccounts']);
        Route::get('/account-mappings', [AccountingReadModelController::class, 'mappings']);
        Route::get('/business-dates', [AccountingReadModelController::class, 'businessDates']);
        Route::get('/periods', [AccountingReadModelController::class, 'periods']);
        Route::get('/readiness', [AccountingReadModelController::class, 'readiness']);
    });
