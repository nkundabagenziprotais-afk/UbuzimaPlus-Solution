<?php

use App\Http\Controllers\Api\V1\PharmaCo360\AccountingApprovalCentreController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingJournalWorkflowController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingReadModelController;
use Illuminate\Support\Facades\Route;

/*
 * Finance classes were added after the production Composer
 * classmap was generated. Composer remains the primary loader;
 * this route-scoped fallback resolves existing App classes only
 * when Composer cannot discover them.
 */
if (!defined('UBUZIMA_ACCOUNTING_APP_AUTOLOADER_REGISTERED')) {
    define('UBUZIMA_ACCOUNTING_APP_AUTOLOADER_REGISTERED', true);

    spl_autoload_register(
        static function (string $class): void {
            $prefix = 'App\\';

            if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
                return;
            }

            $relativeClass = substr($class, strlen($prefix));

            $path = app_path(
                str_replace(
                    '\\',
                    DIRECTORY_SEPARATOR,
                    $relativeClass,
                ) . '.php',
            );

            if (is_file($path)) {
                require_once $path;
            }
        },
        true,
        false,
    );
}

require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingReadModelController.php');
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingJournalWorkflowController.php');
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingApprovalCentreController.php');

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

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.view,finance.journal.approve'
        )->group(function (): void {
            Route::get('/journal-drafts', [AccountingJournalWorkflowController::class, 'index']);
            Route::get('/journal-drafts/{draftUuid}', [AccountingJournalWorkflowController::class, 'show']);
            Route::get('/approvals', [AccountingApprovalCentreController::class, 'index']);
            Route::get('/approvals/{approvalUuid}', [AccountingApprovalCentreController::class, 'show']);
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.create'
        )->group(function (): void {
            Route::post('/journal-drafts', [AccountingJournalWorkflowController::class, 'store']);
            Route::put('/journal-drafts/{draftUuid}', [AccountingJournalWorkflowController::class, 'update']);
            Route::post('/journal-drafts/{draftUuid}/submit', [AccountingJournalWorkflowController::class, 'submit']);
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.approve'
        )->group(function (): void {
            Route::post('/journal-drafts/{draftUuid}/approve', [AccountingJournalWorkflowController::class, 'approve']);
            Route::post('/journal-drafts/{draftUuid}/reject', [AccountingJournalWorkflowController::class, 'reject']);
            Route::post('/journal-drafts/{draftUuid}/post', [AccountingJournalWorkflowController::class, 'post']);
            Route::post('/journal-drafts/{draftUuid}/reverse', [AccountingJournalWorkflowController::class, 'reverse']);
            Route::post('/approvals/{approvalUuid}/approve', [AccountingApprovalCentreController::class, 'approve']);
            Route::post('/approvals/{approvalUuid}/reject', [AccountingApprovalCentreController::class, 'reject']);
        });
    });
