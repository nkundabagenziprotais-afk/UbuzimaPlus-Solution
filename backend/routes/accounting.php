<?php

use App\Http\Controllers\Api\V1\PharmaCo360\AccountingApprovalCentreController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingJournalWorkflowController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingReadModelController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingPeriodCloseController;
use App\Http\Controllers\Api\V1\PharmaCo360\AccountingPeriodManagementController;
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
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingPeriodCloseController.php');
require_once app_path('Http/Controllers/Api/V1/PharmaCo360/AccountingPeriodManagementController.php');

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
        Route::get(
            '/general-ledger-report',
            [
                AccountingReadModelController::class,
                'generalLedgerReport',
            ]
        );
        Route::get(
            '/reconciliation-dashboard',
            [
                AccountingReadModelController::class,
                'reconciliationDashboard',
            ]
        );


        Route::get('/trial-balance', [AccountingReadModelController::class, 'trialBalance']);
        Route::get(
            '/reporting-health',
            [
                AccountingReadModelController::class,
                'reportingHealth',
            ]
        );

        Route::get('/chart-of-accounts', [AccountingReadModelController::class, 'chartOfAccounts']);
        Route::get('/account-mappings', [AccountingReadModelController::class, 'mappings']);
        Route::get('/business-dates', [AccountingReadModelController::class, 'businessDates']);
        Route::get('/periods', [AccountingReadModelController::class, 'periods']);
        Route::get('/readiness', [AccountingReadModelController::class, 'readiness']);

        /* BEGIN AQUILA_FINANCE_F11A_FIXED_ASSETS_READ */

        /*
         * BEGIN AQUILA_FINANCE_F11D_FIXED_ASSET_REPORTS
         *
         * IMPORTANT:
         * These static /fixed-assets/reports/* routes intentionally appear
         * before all dynamic /fixed-assets/{uuid} routes.
         */
        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.reports.view,reports.finance.view'
        )->group(function (): void {
            Route::get(
                '/fixed-assets/reports/summary',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetReportController::class,
                    'summary'
                ]
            );

            Route::get(
                '/fixed-assets/reports/register',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetReportController::class,
                    'register'
                ]
            );

            Route::get(
                '/fixed-assets/reports/depreciation',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetReportController::class,
                    'depreciation'
                ]
            );

            Route::get(
                '/fixed-assets/reports/disposals',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetReportController::class,
                    'disposals'
                ]
            );
        });
        /* END AQUILA_FINANCE_F11D_FIXED_ASSET_REPORTS */


        Route::get(
            '/fixed-assets',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                'index'
            ]
        );

        Route::get(
            '/fixed-assets/{uuid}/schedule',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                'schedule'
            ]
        );

        Route::get(
            '/fixed-assets/{uuid}',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                'show'
            ]
        );


        /*
         * BEGIN AQUILA_FINANCE_F11C_B_DISPOSAL_GL_READ
         */
        Route::get(
            '/fixed-assets/{uuid}/disposals',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                'disposals'
            ]
        );
        /* END AQUILA_FINANCE_F11C_B_DISPOSAL_GL_READ */

        /* END AQUILA_FINANCE_F11A_FIXED_ASSETS_READ */
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

            /* BEGIN AQUILA_FINANCE_F11A_FIXED_ASSETS_WRITE */

            Route::post(
                '/fixed-assets',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                    'store'
                ]
            );

            Route::put(
                '/fixed-assets/{uuid}',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                    'update'
                ]
            );


            /*
             * BEGIN AQUILA_FINANCE_F11C_B_DISPOSAL_GL_CREATE
             *
             * Permission:
             *   finance.journal.create
             *
             * Draft only — NO GL posting.
             */
            Route::post(
                '/fixed-assets/{uuid}/disposals',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                    'storeDisposal'
                ]
            );
            /* END AQUILA_FINANCE_F11C_B_DISPOSAL_GL_CREATE */

            /* END AQUILA_FINANCE_F11A_FIXED_ASSETS_WRITE */
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.approve'
        )->group(function (): void {
            Route::post('/journal-drafts/{draftUuid}/approve', [AccountingJournalWorkflowController::class, 'approve']);
            Route::post('/journal-drafts/{draftUuid}/reject', [AccountingJournalWorkflowController::class, 'reject']);
            Route::post('/journal-drafts/{draftUuid}/post', [AccountingJournalWorkflowController::class, 'post']);
            Route::post('/journal-drafts/{draftUuid}/reverse', [AccountingJournalWorkflowController::class, 'reverse']);

            /*
             * BEGIN AQUILA_FINANCE_F11C_A_DEPRECIATION_GL
             *
             * Existing enclosing middleware:
             *
             *   auth:sanctum
             *   tenant.module:pharmaco.sales
             *   finance.journal.approve
             */
            Route::post(
                '/fixed-assets/{uuid}/depreciation/{scheduleUuid}/post',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                    'postDepreciation'
                ]
            );

            /*
             * BEGIN AQUILA_FINANCE_F11C_B_DISPOSAL_GL_POST
             *
             * Permission:
             *   finance.journal.approve
             */
            Route::post(
                '/fixed-assets/{uuid}/disposals/{disposalUuid}/post',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingFixedAssetController::class,
                    'postDisposal'
                ]
            );
            /* END AQUILA_FINANCE_F11C_B_DISPOSAL_GL_POST */

            /* END AQUILA_FINANCE_F11C_A_DEPRECIATION_GL */
            Route::post('/approvals/{approvalUuid}/approve', [AccountingApprovalCentreController::class, 'approve']);
            Route::post('/approvals/{approvalUuid}/reject', [AccountingApprovalCentreController::class, 'reject']);
        });
    });

require __DIR__ . '/expenses.php';


/*
|--------------------------------------------------------------------------
| AQUILA_FINANCE_F2_R1_2_CLOSE_BOOKS
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.view,finance.journal.approve'
        )->group(function (): void {
            Route::get(
                '/period-close-actions',
                [
                    AccountingPeriodCloseController::class,
                    'index',
                ]
            );


            /*
             * AQUILA_ACCOUNTING_PERIOD_MANAGEMENT_R1
             *
             * Create/Open + Safe Edit only.
             * Close/Re-open/Approve/Reject remain with AccountingPeriodCloseController.
             */
            Route::get(
                '/periods/operational-capabilities',
                [
                    AccountingPeriodManagementController::class,
                    'capabilities',
                ]
            );
            
            Route::post(
                '/periods',
                [
                    AccountingPeriodManagementController::class,
                    'store',
                ]
            );
            
            Route::patch(
                '/periods/{periodId}',
                [
                    AccountingPeriodManagementController::class,
                    'update',
                ]
            );
            
            Route::get(
                '/periods/{periodId}/close-readiness',
                [
                    AccountingPeriodCloseController::class,
                    'readiness',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.create'
        )->group(function (): void {
            Route::post(
                '/periods/{periodId}/close-requests',
                [
                    AccountingPeriodCloseController::class,
                    'requestClose',
                ]
            );

            Route::post(
                '/periods/{periodId}/reopen-requests',
                [
                    AccountingPeriodCloseController::class,
                    'requestReopen',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.approve'
        )->group(function (): void {
            Route::post(
                '/period-close-actions/{actionUuid}/approve',
                [
                    AccountingPeriodCloseController::class,
                    'approve',
                ]
            );

            Route::post(
                '/period-close-actions/{actionUuid}/reject',
                [
                    AccountingPeriodCloseController::class,
                    'reject',
                ]
            );
        });
    });


/*
 * BEGIN AQUILA_FINANCE_F12A_LANDED_COST
 *
 * F12A R1.1 Landed Cost Accounting API
 *
 * Read:
 *   finance.journal.view OR finance.journal.approve
 *
 * Maker:
 *   finance.journal.create
 *
 * Checker:
 *   finance.journal.approve
 */
Route::middleware([
    'api',
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.view,finance.journal.approve'
        )->group(function (): void {

            Route::get(
                '/landed-costs',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingLandedCostController::class,
                    'index',
                ]
            );

            Route::get(
                '/landed-costs/{uuid}',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingLandedCostController::class,
                    'show',
                ]
            );

            Route::get(
                '/goods-receipts/{receiptUuid}/landed-cost-eligibility',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingLandedCostController::class,
                    'eligibility',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.create'
        )->group(function (): void {

            Route::post(
                '/landed-costs',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingLandedCostController::class,
                    'store',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.journal.approve'
        )->group(function (): void {

            Route::post(
                '/landed-costs/{uuid}/post',
                [
                    \App\Http\Controllers\Api\V1\PharmaCo360\AccountingLandedCostController::class,
                    'post',
                ]
            );
        });
    });
/* END AQUILA_FINANCE_F12A_LANDED_COST */



/*
 * AQUILA_QB2_2_R1_3_BANK_RECONCILIATION
 *
 * Existing Accounting route file remains authoritative.
 */
Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/accounting')
    ->group(function (): void {
        Route::get(
            '/bank-reconciliation/accounts',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'accounts',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.view'
        );

        Route::get(
            '/bank-reconciliation/imports',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'imports',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.view'
        );

        Route::get(
            '/bank-reconciliation/imports/{uuid}',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'showImport',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.view'
        );

        Route::post(
            '/bank-reconciliation/imports',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'importStatement',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.add'
        );

        Route::get(
            '/bank-reconciliation/lines/{uuid}/candidates',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'candidates',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.view'
        );

        Route::post(
            '/bank-reconciliation/lines/{uuid}/match',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'match',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.edit'
        );

        Route::delete(
            '/bank-reconciliation/lines/{uuid}/match',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'unmatch',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.edit'
        );

        Route::get(
            '/bank-reconciliation/sessions',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'sessions',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.view'
        );

        Route::post(
            '/bank-reconciliation/sessions',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'createSession',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.add'
        );

        Route::post(
            '/bank-reconciliation/sessions/{uuid}/lock',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\FinanceBankReconciliationController::class,
                'lockSession',
            ]
        )->middleware(
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.finance.reconciliation.manage,finance.reconciliation.edit'
        );
    });
