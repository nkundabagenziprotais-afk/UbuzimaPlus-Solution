<?php

use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\AiCenterController;
use App\Http\Controllers\Api\V1\CorporateMailController;
use App\Http\Controllers\Api\V1\DataLayerController;
use App\Http\Controllers\Api\V1\LocalizationController;
use App\Http\Controllers\Api\V1\MarketManagementController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PlatformContentController;
use App\Http\Controllers\Api\V1\PlatformStatusController;
use App\Http\Controllers\Api\V1\PharmacistChatController;
use App\Http\Controllers\Api\V1\SolutionController;
use App\Http\Controllers\Api\V1\TenantPublicStatusController;
use App\Http\Controllers\Api\V1\PharmaCo360\CoreProfileController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceManagementController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsurancePartnerDocumentController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceClaimSubmissionController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceMembershipController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceClaimController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceReconciliationController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProductReconciliationController;
use App\Http\Controllers\Api\V1\PharmaCo360\InventoryIntelligenceController;
use App\Http\Controllers\Api\V1\PharmaCo360\TrendAnalysisController;
use App\Http\Controllers\Api\V1\PharmaCo360\GeneralItemsController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProcurementController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProcurementApController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReportingController;
use App\Http\Controllers\Api\V1\PharmaCo360\FinanceReportController;
use App\Http\Controllers\Api\V1\PharmaCo360\FinanceCommercialReadModelController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReceivablesController;
use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
use App\Http\Controllers\Api\V1\PharmaCo360\PosOperationsController;
use App\Http\Controllers\Api\V1\PharmaCo360\PosSessionAdminController;
use App\Http\Controllers\Api\V1\PharmaCo360\HistoricalPosApprovalController;
use App\Http\Controllers\Api\V1\PharmaCo360\HistoricalPosSessionController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/vitapharma', [
    \App\Http\Controllers\Api\V1\TenantResolutionController::class,
    'vitapharma',
])->name('tenant-resolution.vitapharma');

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthController::class);
    Route::get('/platform/status', PlatformStatusController::class);
    Route::get('/platform-content/public', [PlatformContentController::class, 'publicPages']);
    Route::get('/localization/context', [LocalizationController::class, 'context']);
    Route::get('/markets', [MarketManagementController::class, 'publicMarkets']);
    Route::get('/nearby/providers', [MarketManagementController::class, 'nearbyProviders']);
    Route::get('/solutions', [SolutionController::class, 'index']);
    Route::get('/tenants/{slug}/public-status', [TenantPublicStatusController::class, 'show']);
});

Route::prefix('v1/mobile/pharmacist-chat')->group(function () {
    Route::post('/conversations', [PharmacistChatController::class, 'createMobileConversation']);
    Route::get('/conversations/{conversation:uuid}', [PharmacistChatController::class, 'mobileConversation']);
    Route::post('/conversations/{conversation:uuid}/messages', [PharmacistChatController::class, 'createMobileMessage']);
});


Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'login']);
    Route::post('/password-reset-request', [\App\Http\Controllers\Api\V1\AuthController::class, 'passwordResetRequest']);
    Route::post('/two-factor/verify', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'verify']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [\App\Http\Controllers\Api\V1\AuthController::class, 'me']);
        Route::post('/logout', [\App\Http\Controllers\Api\V1\AuthController::class, 'logout']);
        Route::post('/change-password', [\App\Http\Controllers\Api\V1\AuthController::class, 'changePassword']);
        Route::get('/two-factor/status', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'status']);
        Route::post('/two-factor/setup', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'setup']);
        Route::post('/two-factor/recovery-codes', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'recoveryCodes']);
        Route::delete('/two-factor/trusted-devices/{trustedDevice}', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'revokeTrustedDevice']);
    });
});


Route::middleware('auth:sanctum')->prefix('v1/access-check')->group(function () {
    Route::get('/security', [\App\Http\Controllers\Api\V1\AccessCheckController::class, 'securitySummary'])
        ->middleware('permission:roles.manage');

    Route::get('/security/role-templates', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'roleTemplatesResponse'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::get('/security/users', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'index'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'store'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::put('/security/users/{user}', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'update'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');
    Route::post('/security/users/{user}/branch', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'assignBranch']);

    Route::delete('/security/users/{user}', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'deactivate'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');


    Route::get('/security/operations', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'summary'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/force-password-change', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'forcePasswordChange'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/reset-password', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'resetPassword'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/reset-two-factor', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'resetTwoFactor'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/revoke-trusted-devices', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'revokeTrustedDevices'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/revoke-sessions', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'revokeSessions'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/users/{user}/status', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'updateStatus'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');


    Route::get('/security/audit-timeline', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'auditTimeline'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::get('/security/roles', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'index'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/roles/assess', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'assess'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/roles', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'store'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/roles/{role}/clone', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'cloneRole'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::put('/security/roles/{role}', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'update'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::post('/security/roles/{role}/archive', [\App\Http\Controllers\Api\V1\RoleGovernanceController::class, 'archive'])
        ->middleware('App\Http\Middleware\EnsureAnyPermission:roles.manage,tenant.roles.manage');

    Route::get('/inventory', [\App\Http\Controllers\Api\V1\AccessCheckController::class, 'inventoryAccessCheck'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/ai', [\App\Http\Controllers\Api\V1\AccessCheckController::class, 'aiAccessCheck'])
        ->middleware([
            'permission:ai.use',
            'tenant.module:platform.ai_center',
        ]);
});

Route::middleware(['auth:sanctum', 'permission:platform.content.manage'])
    ->prefix('v1/platform-management')
    ->group(function () {
        Route::get('/pages', [PlatformContentController::class, 'adminPages']);
        Route::post('/pages', [PlatformContentController::class, 'storePage']);
        Route::patch('/pages/{page}', [PlatformContentController::class, 'updatePage']);
        Route::post('/pages/{page}/sections', [PlatformContentController::class, 'storeSection']);
        Route::patch('/sections/{section}', [PlatformContentController::class, 'updateSection']);
    });

Route::middleware('auth:sanctum')
    ->prefix('v1/localization')
    ->group(function () {
        Route::post('/preference', [LocalizationController::class, 'setPreference']);
    });

Route::middleware(['auth:sanctum', 'permission:markets.manage'])
    ->prefix('v1/admin/markets')
    ->group(function () {
        Route::get('/', [MarketManagementController::class, 'adminIndex']);
        Route::post('/assign-tenant', [MarketManagementController::class, 'assignTenant']);
    });

Route::middleware('auth:sanctum')
    ->prefix('v1/notifications')
    ->group(function () {
        Route::get('/', [NotificationController::class, 'index'])
            ->middleware('permission:notifications.view');
        Route::post('/', [NotificationController::class, 'store'])
            ->middleware('permission:notifications.manage');
        Route::post('/{notification}/read', [NotificationController::class, 'markRead'])
            ->middleware('permission:notifications.view');
    });

Route::middleware(['auth:sanctum', 'permission:communications.email.use'])
    ->prefix('v1/corporate-mail')
    ->group(function () {
        Route::get('/overview', [CorporateMailController::class, 'overview']);
        Route::post('/messages', [CorporateMailController::class, 'send']);
    });

Route::middleware(['auth:sanctum', 'permission:pharmaco.chat.manage'])
    ->prefix('v1/pharmacist-chat')
    ->group(function () {
        Route::get('/conversations', [PharmacistChatController::class, 'staffConversations']);
        Route::get('/conversations/{conversation:uuid}', [PharmacistChatController::class, 'staffConversation']);
        Route::post('/conversations/{conversation:uuid}/messages', [PharmacistChatController::class, 'staffReply']);
        Route::patch('/conversations/{conversation:uuid}', [PharmacistChatController::class, 'updateStaffConversation']);
    });

Route::middleware(['auth:sanctum', 'permission:data.layer.manage'])
    ->prefix('v1/admin/data-layer')
    ->group(function () {
        Route::get('/schema', [DataLayerController::class, 'schema']);
        Route::get('/tables/{table}/rows', [DataLayerController::class, 'rows']);
        Route::patch('/tables/{table}/rows/{id}', [DataLayerController::class, 'updateRow']);
        Route::delete('/tables/{table}/rows/{id}', [DataLayerController::class, 'deleteRow']);
        Route::post('/sql', [DataLayerController::class, 'runSql']);
    });

Route::middleware(['auth:sanctum', 'permission:ai.manage', 'tenant.module:platform.ai_center'])
    ->prefix('v1/ai-center')
    ->group(function () {
        Route::get('/overview', [AiCenterController::class, 'overview']);
        Route::post('/activate-defaults', [AiCenterController::class, 'activateDefaults']);
        Route::post('/recommendations/inventory/generate', [AiCenterController::class, 'generateInventoryRecommendations']);
        Route::patch('/recommendations/{recommendation}', [AiCenterController::class, 'updateRecommendation']);
    });

Route::middleware('auth:sanctum')->prefix('v1/pharmaco')->group(function () {

    Route::prefix('pos')
        ->middleware([
            'App\\Http\\Middleware\\EnsureAnyPermission:pharmaco.sales.manage,pharmaco.pos.use,pharmaco.sales.create',
            'tenant.module:pharmaco.sales',
        ])
        ->group(function () {
            Route::get(
                '/session/current',
                [PosOperationsController::class, 'current']
            );

            Route::post(
                '/session/open',
                [PosOperationsController::class, 'open']
            );

            Route::post(
                '/sessions/{session}/cash-drop',
                [PosOperationsController::class, 'cashDrop']
            );

            Route::post(
                '/sessions/{session}/zeroize',
                [PosOperationsController::class, 'zeroize']
            );

            Route::post(
                '/sessions/{session}/clear-balance',
                [PosOperationsController::class, 'zeroize']
            );

            Route::post(
                '/sessions/{session}/close',
                [PosOperationsController::class, 'close']
            );

            Route::post(
                '/sessions/{session}/admin-reset',
                [PosOperationsController::class, 'adminReset']
            )->middleware(
                'permission:pharmaco.pos.session.reset'
            );

            /*
             * AQUILA_POS_SESSION_ADMIN_CONTROL_20260713
             * Tenant-scoped support operations with mandatory reasons
             * and immutable historical session numbering.
             */
            /*
             * AQUILA_PWA_POS_OPEN_SUMMARY_R1
             * Read-only Open Till projection.
             */
            Route::get(
                '/sessions/open-summary',
                [
                    PosSessionAdminController::class,
                    'openSummary',
                ]
            )->middleware(
                'permission:pharmaco.pos.session.reset'
            );

            Route::get(
                '/sessions/admin',
                [
                    PosSessionAdminController::class,
                    'index',
                ]
            )->middleware(
                'permission:pharmaco.pos.session.reset'
            );

            Route::post(
                '/sessions/{session}/force-close',
                [
                    PosSessionAdminController::class,
                    'forceClose',
                ]
            )->middleware(
                'permission:pharmaco.pos.session.reset'
            );

            Route::post(
                '/sessions/{session}/reset-limit',
                [
                    PosSessionAdminController::class,
                    'resetLimit',
                ]
            )->middleware(
                'permission:pharmaco.pos.session.reset'
            );

            Route::get(
                '/recent-transactions',
                [
                    PosOperationsController::class,
                    'recentTransactions',
                ]
            );

            Route::get(
                '/historical/session/current',
                [
                    HistoricalPosSessionController::class,
                    'current',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.view'
            );

            Route::post(
                '/historical/session/open',
                [
                    HistoricalPosSessionController::class,
                    'open',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.open'
            );

            Route::get(
                '/historical/availability',
                [
                    HistoricalPosApprovalController::class,
                    'availability',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.open'
            );

            Route::post(
                '/historical/approvals',
                [
                    HistoricalPosApprovalController::class,
                    'requestApproval',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.open'
            );

            Route::get(
                '/historical/approvals',
                [
                    HistoricalPosApprovalController::class,
                    'index',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.approve'
            );

            Route::post(
                '/historical/approvals/{approval}/approve',
                [
                    HistoricalPosApprovalController::class,
                    'approve',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.approve'
            );

            Route::post(
                '/historical/approvals/{approval}/reject',
                [
                    HistoricalPosApprovalController::class,
                    'reject',
                ]
            )->middleware(
                'permission:pharmaco.pos.historical.approve'
            );
        });

    Route::prefix('insurance')
        ->middleware([
            'tenant.module:pharmaco.insurance',
        ])
        ->group(function () {
            Route::post('/bootstrap', [
                InsuranceManagementController::class,
                'bootstrap',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.configuration.manage');

            Route::get('/partners', [
                InsuranceManagementController::class,
                'partners',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.view');

            Route::post('/partners', [
                InsuranceManagementController::class,
                'createPartner',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.manage');

            Route::patch('/partners/{insurancePartner}', [
                InsuranceManagementController::class,
                'updatePartner',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.manage');

            Route::get('/partners/{insurancePartner}/documents', [
                InsurancePartnerDocumentController::class,
                'index',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.view');

            Route::post('/partners/{insurancePartner}/documents', [
                InsurancePartnerDocumentController::class,
                'store',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.manage');

            Route::patch('/partners/{insurancePartner}/documents/{document}', [
                InsurancePartnerDocumentController::class,
                'update',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.providers.manage');

            Route::get('/schemes', [
                InsuranceManagementController::class,
                'schemes',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.plans.view');

            Route::post('/schemes', [
                InsuranceManagementController::class,
                'createScheme',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.plans.manage');

            Route::get('/institutions', [
                InsuranceManagementController::class,
                'institutions',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.configuration.view');

            Route::post('/institutions', [
                InsuranceManagementController::class,
                'createInstitution',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.configuration.manage');

            Route::patch('/institutions/{insuranceInstitution}', [
                InsuranceManagementController::class,
                'updateInstitution',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.configuration.manage');

            Route::patch('/schemes/{insuranceScheme}', [
                InsuranceManagementController::class,
                'updateScheme',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.plans.manage');

            Route::get('/price-lists', [
                InsuranceManagementController::class,
                'priceLists',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.view');

            Route::post('/price-lists', [
                InsuranceManagementController::class,
                'createPriceList',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.create');

            Route::patch('/price-lists/{insurancePriceList}', [
                InsuranceManagementController::class,
                'updatePriceList',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.edit');

            Route::get('/product-prices', [
                InsuranceManagementController::class,
                'productPrices',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.view');

            Route::post('/product-prices', [
                InsuranceManagementController::class,
                'upsertProductPrice',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.edit');

            Route::post('/product-prices/bulk-import', [
                InsuranceManagementController::class,
                'bulkImportProductPrices',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.import');

            Route::get('/product-prices/export', [
                InsuranceManagementController::class,
                'exportProductPrices',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.view');

            Route::get('/contribution-rules', [
                InsuranceManagementController::class,
                'contributionRules',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.view');

            Route::post('/contribution-rules', [
                InsuranceManagementController::class,
                'createContributionRule',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.create');

            Route::patch(
                '/contribution-rules/{insuranceContributionRule}',
                [
                    InsuranceManagementController::class,
                    'updateContributionRule',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.edit');

            Route::get('/memberships', [
                InsuranceMembershipController::class,
                'memberships',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.memberships.view');

            Route::post('/memberships', [
                InsuranceMembershipController::class,
                'createMembership',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.memberships.manage');

            Route::patch(
                '/memberships/{customerInsuranceMembership}',
                [
                    InsuranceMembershipController::class,
                    'updateMembership',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.memberships.manage');

            Route::post(
                '/memberships/{customerInsuranceMembership}/eligibility',
                [
                    InsuranceMembershipController::class,
                    'checkEligibility',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.eligibility.check');

            Route::get('/claims', [
                InsuranceClaimController::class,
                'claims',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.view');

            Route::get('/sales-register', [
                InsuranceClaimSubmissionController::class,
                'salesRegister',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.analytics.view');

            Route::post('/claims/from-sale', [
                InsuranceClaimController::class,
                'createFromSale',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.create');

            Route::post(
                '/claims/{insuranceClaim}/submit',
                [
                    InsuranceClaimController::class,
                    'submitClaim',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.edit');

            Route::post(
                '/claims/{insuranceClaim}/submission-settings',
                [
                    InsuranceClaimSubmissionController::class,
                    'updateSettings',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.edit');

            Route::post(
                '/claims/{insuranceClaim}/submission-events',
                [
                    InsuranceClaimSubmissionController::class,
                    'recordEvent',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.edit');

            Route::post(
                '/claims/{insuranceClaim}/mark-invoice-submitted',
                [
                    InsuranceClaimSubmissionController::class,
                    'markSubmitted',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.edit');

            Route::post(
                '/claims/{insuranceClaim}/adjudicate',
                [
                    InsuranceClaimController::class,
                    'adjudicateClaim',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.adjudicate');

            Route::post(
                '/claims/{insuranceClaim}/payments',
                [
                    InsuranceClaimController::class,
                    'recordClaimPayment',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.payments');

            Route::get(
                '/reconciliation-batches',
                [
                    InsuranceReconciliationController::class,
                    'index',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.view');

            Route::post(
                '/reconciliation-batches',
                [
                    InsuranceReconciliationController::class,
                    'store',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.manage');

            Route::get(
                '/reconciliation-batches/{insuranceReconciliationBatch}',
                [
                    InsuranceReconciliationController::class,
                    'show',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.view');

            Route::post(
                '/reconciliation-batches/{insuranceReconciliationBatch}/submit',
                [
                    InsuranceReconciliationController::class,
                    'submit',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.manage');

            Route::get(
                '/reconciliation-batches/{insuranceReconciliationBatch}/eligible-payments',
                [
                    InsuranceReconciliationController::class,
                    'eligiblePayments',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.view');

            Route::post(
                '/reconciliation-batches/{insuranceReconciliationBatch}/reconcile',
                [
                    InsuranceReconciliationController::class,
                    'reconcile',
                ]
            )->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.reconciliation.manage');

            Route::get('/claims/{insuranceClaim}', [
                InsuranceClaimController::class,
                'claim',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.claims.view');

            Route::post('/pricing/resolve', [
                InsuranceManagementController::class,
                'resolvePricing',
            ])->middleware('App\Http\Middleware\EnsureAnyPermission:pharmaco.insurance.manage,insurance.pricing.view');
        });

    Route::get('/receivables', [ReceivablesController::class, 'receivables'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/receivables', [ReceivablesController::class, 'createReceivable'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/receivables/{receivable}', [ReceivablesController::class, 'receivable'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/receivables/{receivable}/payments', [ReceivablesController::class, 'recordPayment'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::patch('/customers/{customer}/credit', [ReceivablesController::class, 'updateCustomerCredit'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);



    Route::get('/reports/overview', [ReportingController::class, 'overview'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/reports/inventory-valuation', [ReportingController::class, 'inventoryValuation'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/reports/sales-summary', [ReportingController::class, 'salesSummary'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/reports/procurement-summary', [ReportingController::class, 'procurementSummary'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/reports/payables-summary', [ReportingController::class, 'payablesSummary'])
        ->middleware([
            'permission:pharmaco.procurement.payment.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/finance/reports/pos-shadow-reconciliation', [FinanceReportController::class, 'posShadowReconciliation'])
        ->middleware([
            'tenant.module:pharmaco.sales',
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.reports.view,finance.reconciliation.view,finance.reconciliation.manage',
        ]);

    Route::get('/finance/reports/pos-revenue-shadow', [FinanceReportController::class, 'posRevenueShadow'])
        ->middleware([
            'tenant.module:pharmaco.sales',
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.reports.view,finance.reconciliation.view,finance.reconciliation.manage',
        ]);

    Route::get('/finance/reports/readiness-health', [FinanceReportController::class, 'readinessHealth'])
        ->middleware([
            'tenant.module:pharmaco.sales',
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.reports.view,finance.reconciliation.view,finance.reconciliation.manage',
        ]);

    Route::prefix('finance/commercial')
        ->middleware([
            'tenant.module:pharmaco.sales',
            'App\\Http\\Middleware\\EnsureAnyPermission:finance.dashboard.view,finance.reports.view,reports.finance.view,finance.journal.view,finance.reconciliation.view',
        ])
        ->group(function () {
            Route::get('/overview', [FinanceCommercialReadModelController::class, 'overview']);
            Route::get('/flow', [FinanceCommercialReadModelController::class, 'flow']);
            Route::get('/exceptions', [FinanceCommercialReadModelController::class, 'exceptions']);
            Route::get('/receivables', [FinanceCommercialReadModelController::class, 'receivables']);
            Route::get('/receivable-register', [FinanceCommercialReadModelController::class, 'receivableRegister']);
            Route::get('/collections', [FinanceCommercialReadModelController::class, 'collections']);
            Route::get('/profit-loss', [FinanceCommercialReadModelController::class, 'profitLoss']);
            Route::get('/profit-loss/monthly-position', [FinanceCommercialReadModelController::class, 'profitLossMonthlyPosition']);
            Route::get('/balance-sheet', [FinanceCommercialReadModelController::class, 'balanceSheet']);
            Route::get('/balance-sheet/monthly-position', [FinanceCommercialReadModelController::class, 'balanceSheetMonthlyPosition']);
            Route::get('/cash-flow', [FinanceCommercialReadModelController::class, 'cashFlow']);
            Route::get('/sales', [FinanceCommercialReadModelController::class, 'sales']);
            /*
             * ADVREP-R2A-R2 — read-only Customer Statements.
             * Existing finance/commercial authentication and
             * permission middleware remains authoritative.
             */
            Route::get(
                '/customer-statement',
                [ReportingController::class, 'customerStatement']
            );

            Route::get(
                '/customer-statement/export',
                [ReportingController::class, 'customerStatementExport']
            );

            Route::get('/source-health', [FinanceCommercialReadModelController::class, 'sourceHealthEndpoint']);
        });

    Route::get('/reports/customer-credit-exposure', [ReportingController::class, 'customerCreditExposure'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/reports/customer-credit-exposure/export', [ReportingController::class, 'customerCreditExposureExport'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);





    Route::post('/suppliers', [ProcurementController::class, 'createSupplier'])
        ->middleware([
            'permission:pharmaco.procurement.suppliers.create',
            'tenant.module:pharmaco.suppliers',
        ]);



    /*
     * AQUILA_FINANCE_F4_R5_R2_R1_COMMERCIAL_AP_ROUTES
     */

    Route::get('/ap/overview', [ProcurementApController::class, 'overview'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/ap/reference-data', [ProcurementApController::class, 'referenceData'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/ap/aging', [ProcurementApController::class, 'aging'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/suppliers/{supplier}/statement', [ProcurementApController::class, 'supplierStatement'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);


    /*
     * F4-R6 Physical Supplier Return
     *
     * Stock-return credits are owned by this governed workflow.
     * Existing accounting-only Supplier Credit safety remains intact.
     */
    Route::get(
        '/supplier-returns',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'index']
    )
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get(
        '/supplier-returns/reference-data',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnReadController::class, 'referenceData']
    )
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get(
        '/supplier-returns/{supplierReturn}',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'show']
    )
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post(
        '/supplier-returns',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'create']
    )
        ->middleware([
            'permission:pharmaco.procurement.invoice.manage',
            'permission:pharmaco.product_inventory.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post(
        '/supplier-returns/{supplierReturn}/submit',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'submit']
    )
        ->middleware([
            'permission:pharmaco.procurement.invoice.manage',
            'permission:pharmaco.product_inventory.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post(
        '/supplier-returns/{supplierReturn}/approve',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'approve']
    )
        ->middleware([
            'permission:pharmaco.procurement.invoice.approve',
            'permission:pharmaco.product_inventory.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post(
        '/supplier-returns/{supplierReturn}/reject',
        [\App\Http\Controllers\Api\V1\PharmaCo360\SupplierReturnController::class, 'reject']
    )
        ->middleware([
            'permission:pharmaco.procurement.invoice.approve',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/supplier-credits', [ProcurementApController::class, 'credits'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-credits', [ProcurementApController::class, 'createCredit'])
        ->middleware([
            'permission:pharmaco.procurement.invoice.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-credits/{credit}/approve', [ProcurementApController::class, 'approveCredit'])
        ->middleware([
            'permission:pharmaco.procurement.invoice.approve',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/supplier-advances', [ProcurementApController::class, 'advances'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.procurement.payment.view,finance.reports.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-advances', [ProcurementApController::class, 'createAdvance'])
        ->middleware([
            'permission:pharmaco.procurement.payment.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-advances/{advance}/approve', [ProcurementApController::class, 'approveAdvance'])
        ->middleware([
            'permission:pharmaco.procurement.payment.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-advances/{advance}/applications', [ProcurementApController::class, 'applyAdvance'])
        ->middleware([
            'permission:pharmaco.procurement.payment.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/supplier-invoices', [ProcurementController::class, 'supplierInvoices'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices', [ProcurementController::class, 'createSupplierInvoice'])
        ->middleware([
            'permission:pharmaco.procurement.invoice.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/supplier-invoices/{supplierInvoice}', [ProcurementController::class, 'supplierInvoice'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices/{supplierInvoice}/approve', [ProcurementController::class, 'approveSupplierInvoice'])
        ->middleware([
            'permission:pharmaco.procurement.invoice.approve',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices/{supplierInvoice}/payments', [ProcurementController::class, 'recordSupplierPayment'])
        ->middleware([
            'permission:pharmaco.procurement.payment.manage',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::get('/suppliers', [ProcurementController::class, 'suppliers'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.view,pharmaco.product_inventory.receive',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::patch('/suppliers/{supplier}', [ProcurementController::class, 'updateSupplier'])
        ->middleware([
            'permission:pharmaco.procurement.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/purchase-orders/{purchaseOrder}/approve', [ProcurementController::class, 'approvePurchaseOrder'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.approve',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/purchase-orders/{purchaseOrder}/cancel', [ProcurementController::class, 'cancelPurchaseOrder'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.approve',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::post('/purchase-orders', [ProcurementController::class, 'createPurchaseOrder'])
        ->middleware([
            'App\Http\Middleware\EnsureAnyPermission:pharmaco.procurement.purchase_order.create,procurement.purchase_orders.add',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/purchase-orders', [ProcurementController::class, 'purchaseOrders'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/purchase-orders/{purchaseOrder}', [ProcurementController::class, 'purchaseOrder'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::get('/general-item-categories', [GeneralItemsController::class, 'categories'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-item-categories/seed-defaults', [GeneralItemsController::class, 'seedDefaultCategories'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-item-categories', [GeneralItemsController::class, 'createCategory'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::patch('/general-item-categories/{category}', [GeneralItemsController::class, 'updateCategory'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/general-items', [GeneralItemsController::class, 'items'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-items', [GeneralItemsController::class, 'createItem'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::patch('/general-items/{item}', [GeneralItemsController::class, 'updateItem'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/general-item-locations', [GeneralItemsController::class, 'locations'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-item-locations', [GeneralItemsController::class, 'createLocation'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::patch('/general-item-locations/{location}', [GeneralItemsController::class, 'updateLocation'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.create',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/general-item-stock/summary', [GeneralItemsController::class, 'summary'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/general-item-stock', [GeneralItemsController::class, 'stock'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/purchase-orders/{purchaseOrder}/general-items/receive', [GeneralItemsController::class, 'receivePurchaseOrder'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-item-stock/receive', [GeneralItemsController::class, 'receive'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/general-item-stock/issue', [GeneralItemsController::class, 'issue'])
        ->middleware([
            'permission:pharmaco.procurement.purchase_order.receive',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/general-item-movements', [GeneralItemsController::class, 'movements'])
        ->middleware([
            'permission:pharmaco.procurement.view',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::get(
        '/inventory/near-expiry-batches',
        [
            ProductInventoryController::class,
            'nearExpiryBatches',
        ]
    )->middleware([
        'App\\Http\\Middleware\\EnsureAnyPermission:pharmaco.inventory.view,pharmaco.inventory.manage',
        'tenant.module:pharmaco.inventory',
    ])->name('inventory.near-expiry-batches');

    /*
     * AQUILA_INVENTORY_INTELLIGENCE_20260713
     * Real signed movement history and reconstructed daily
     * near-expiry inventory exposure.
     */
    Route::get(
        '/inventory/intelligence',
        [
            InventoryIntelligenceController::class,
            'index',
        ]
    )->middleware([
        'App\Http\Middleware\EnsureAnyPermission:pharmaco.inventory.view,pharmaco.inventory.manage',
        'tenant.module:pharmaco.inventory',
    ]);

    /*
     * AQUILA_PWA_INVENTORY_MOVEMENT_SUMMARY_R1
     * Read-only period movement summary.
     */
    Route::get(
        '/inventory/movement-summary',
        [
            InventoryIntelligenceController::class,
            'movementSummary',
        ]
    )->middleware([
        'App\Http\Middleware\EnsureAnyPermission:pharmaco.inventory.view,pharmaco.inventory.manage',
        'tenant.module:pharmaco.inventory',
    ])->name(
        'inventory.movement-summary'
    );


        Route::get('/trend-analysis', [
            TrendAnalysisController::class,
            'index',
        ])->middleware('App\\Http\\Middleware\\EnsureAnyPermission:pharmaco.analytics.view,pharmaco.inventory.view,inventory.view,pharmaco.sales.view,insurance.analytics.view');


    Route::prefix('/product-master/reconciliation')
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ])
        ->group(function (): void {
            Route::get('/summary', [
                ProductReconciliationController::class,
                'summary',
            ])->name('product-reconciliation.summary');

            Route::get('/rows', [
                ProductReconciliationController::class,
                'rows',
            ])->name('product-reconciliation.rows');

            Route::patch('/rows/{row}/review', [
                ProductReconciliationController::class,
                'reviewRow',
            ])->name('product-reconciliation.rows.review');

            Route::get('/duplicates', [
                ProductReconciliationController::class,
                'duplicates',
            ])->name('product-reconciliation.duplicates');

            Route::patch('/duplicates/{proposal}/review', [
                ProductReconciliationController::class,
                'reviewDuplicate',
            ])->name('product-reconciliation.duplicates.review');

            Route::get('/payer-prices', [
                ProductReconciliationController::class,
                'payerPrices',
            ])->name('product-reconciliation.payer-prices');
        });

    Route::get('/product-categories', [ProductInventoryController::class, 'productCategories'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/product-categories', [ProductInventoryController::class, 'createProductCategory'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::patch('/product-categories/{productCategory}', [ProductInventoryController::class, 'updateProductCategory'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/products', [ProductInventoryController::class, 'createProduct'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/products', [ProductInventoryController::class, 'products'])
        ->middleware([
            'permission:pharmaco.product_master.view',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/products/bulk-import', [ProductInventoryController::class, 'bulkImportProducts'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/products/bulk-action', [ProductInventoryController::class, 'bulkProductAction'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post(
        '/products/{product}/selling-unit-ai-suggestion/generate',
        [ProductInventoryController::class, 'generateSellingUnitSuggestion']
    )->middleware([
        'permission:pharmaco.inventory.manage',
        'tenant.module:pharmaco.inventory',
    ]);

    Route::post(
        '/products/{product}/selling-unit-ai-suggestion/review',
        [ProductInventoryController::class, 'reviewSellingUnitSuggestion']
    )->middleware([
        'permission:pharmaco.inventory.manage',
        'tenant.module:pharmaco.inventory',
    ]);

    Route::get('/products/{product}', [ProductInventoryController::class, 'product'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::patch('/products/{product}', [ProductInventoryController::class, 'updateProduct'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);
    Route::delete('/products/{product}', [ProductInventoryController::class, 'deleteProduct'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/inventory/receive', [ProductInventoryController::class, 'receiveStock'])
        ->middleware([
            'permission:pharmaco.product_inventory.receive',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/inventory/locations', [ProductInventoryController::class, 'locations'])
        ->middleware([
            'permission:pharmaco.inventory.view',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/inventory/locations', [ProductInventoryController::class, 'createStockLocation'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::patch('/inventory/locations/{stockLocation}', [ProductInventoryController::class, 'updateStockLocation'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::delete('/inventory/locations/{stockLocation}', [ProductInventoryController::class, 'deleteStockLocation'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/inventory/batches', [ProductInventoryController::class, 'batches'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::put('/inventory/batches/{batch}', [ProductInventoryController::class, 'updateBatch'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::delete('/inventory/batches/{batch}', [ProductInventoryController::class, 'deleteBatch'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post('/inventory/batches/{batch}/delete', [ProductInventoryController::class, 'deleteBatch'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    /*
     * Deleted Inventory / Recycle Bin
     *
     * Uses the existing inventory.manage permission
     * boundary. No public or POS access is exposed.
     */
    Route::get(
        '/inventory/deleted-batches',
        [ProductInventoryController::class, 'deletedBatches']
    )
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::post(
        '/inventory/deleted-batches/{archive}/restore',
        [ProductInventoryController::class, 'restoreDeletedBatch']
    )
        ->whereNumber('archive')
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::delete(
        '/inventory/deleted-batches/{archive}/permanent',
        [ProductInventoryController::class, 'permanentlyDeleteDeletedBatch']
    )
        ->whereNumber('archive')
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'permission:pharmaco.product_inventory.delete',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/inventory/summary', [ProductInventoryController::class, 'summary'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);
    Route::get('/inventory/analytics-summary', [ProductInventoryController::class, 'analyticsSummary'])->name('inventory.analytics-summary');

    Route::get('/profile', [CoreProfileController::class, 'profile'])
        ->middleware([
            'permission:pharmaco.profile.manage',
            'tenant.module:pharmaco.profile',
        ]);

    Route::get('/branches', [CoreProfileController::class, 'branches'])
        ->middleware([
            'permission:branches.view',
            'tenant.module:pharmaco.branches',
        ]);

    Route::get('/branches/{branch}/departments', [CoreProfileController::class, 'branchDepartments'])
        ->middleware([
            'permission:pharmaco.branches.manage',
            'tenant.module:pharmaco.branches',
        ]);

    Route::patch('/branches/{branch}', [CoreProfileController::class, 'updateBranch'])
        ->middleware([
            'permission:pharmaco.branches.manage',
            'tenant.module:pharmaco.branches',
        ]);

    Route::post('/branches/{branch}/departments', [CoreProfileController::class, 'createBranchDepartment'])
        ->middleware([
            'permission:pharmaco.branches.manage',
            'tenant.module:pharmaco.branches',
        ]);

    Route::patch('/branches/{branch}/departments/{department}', [CoreProfileController::class, 'updateBranchDepartment'])
        ->middleware([
            'permission:pharmaco.branches.manage',
            'tenant.module:pharmaco.branches',
        ]);


    Route::post('/customers', [SalesDispensingController::class, 'createCustomer'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::patch('/customers/{customer}', [SalesDispensingController::class, 'updateCustomer'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/customers', [SalesDispensingController::class, 'customers'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


    Route::post('/prescriptions', [SalesDispensingController::class, 'createPrescription'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::patch('/prescriptions/{prescription}', [SalesDispensingController::class, 'updatePrescription'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/prescriptions/{prescription}/attachment', [SalesDispensingController::class, 'uploadPrescriptionAttachment'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/prescriptions/{prescription}/attachment', [SalesDispensingController::class, 'prescriptionAttachment'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/prescriptions', [SalesDispensingController::class, 'prescriptions'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


    Route::post('/sales', [SalesDispensingController::class, 'createSale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/sales', [SalesDispensingController::class, 'sales'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);



    Route::post('/sales/{sale}/payments', [SalesDispensingController::class, 'recordPayment'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/sales/{sale}/confirm', [SalesDispensingController::class, 'confirmSale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


    Route::get(
        '/sales/returns',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'index',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post('/sales/checkout', [SalesDispensingController::class, 'checkoutSale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/sales', [SalesDispensingController::class, 'sales'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);



    Route::post('/sales/{sale}/payments', [SalesDispensingController::class, 'recordPayment'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/sales/{sale}/confirm', [SalesDispensingController::class, 'confirmSale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


    Route::get(
        '/sales/returns',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'index',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::get(
        '/sales/returns/{saleReturn}',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'show',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/sales/{sale}/returns',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'store',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/sales/returns/{saleReturn}/approve',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'approve',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/sales/returns/{saleReturn}/reject',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'reject',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/sales/payments/{payment}/reconcile',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\SaleReturnsController::class,
            'reconcilePayment',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::get(
        '/momo/parser-templates',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'templates',
        ]
    )->middleware([
        'permission:pharmaco.sales.manage',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/momo/parser-templates',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'storeTemplate',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::get(
        '/momo/messages',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'messages',
        ]
    )->middleware([
        'permission:pharmaco.sales.manage',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/momo/messages/ingest',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'ingest',
        ]
    )->middleware([
        'permission:pharmaco.sales.manage',
        'tenant.module:pharmaco.sales',
    ]);

    Route::get(
        '/momo/reconciliations',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'reconciliations',
        ]
    )->middleware([
        'permission:pharmaco.sales.manage',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/momo/reconciliations/{reconciliation}/approve',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'approve',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post(
        '/momo/reconciliations/{reconciliation}/reject',
        [
            \App\Http\Controllers\Api\V1\PharmaCo360\MomoReconciliationController::class,
            'reject',
        ]
    )->middleware([
        'permission:pharmaco.pos.refund',
        'tenant.module:pharmaco.sales',
    ]);

    Route::post('/sales/{sale}/items/{item}/void', [SalesDispensingController::class, 'voidSaleItem'])
        ->middleware([
            'App\\Http\\Middleware\\EnsureAnyPermission:pharmaco.transactions.delete,pharmaco.transactions.correct,pharmaco.pos.refund,pharmaco.sales.manage,pharmaco.sales.refund,tenant.admin,platform.admin,tenant.roles.manage,roles.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::post('/sales/{sale}/void', [SalesDispensingController::class, 'voidSale'])
        ->middleware([
            'App\\Http\\Middleware\\EnsureAnyPermission:pharmaco.transactions.delete,pharmaco.transactions.correct,pharmaco.pos.refund,pharmaco.sales.manage,pharmaco.sales.refund,tenant.admin,platform.admin,tenant.roles.manage,roles.manage',
            'tenant.module:pharmaco.sales',
        ]);

    Route::get('/sales/{sale}/invoice', [SalesDispensingController::class, 'invoice'])
        ->name('pharmaco.sales.invoice');

    Route::get('/sales/{sale}', [SalesDispensingController::class, 'sale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


});

/*
|--------------------------------------------------------------------------
| AQUILA_GENERAL_ITEMS_OPERATIONAL_ROUTES_START
|--------------------------------------------------------------------------
|
| Operational General Items management moved from Procurement into the
| dedicated General Stock Items workspace.
|
*/

Route::middleware('auth:sanctum')
    ->prefix(
        'v1/tenants/{tenantSlug}/pharmaco360/general-items'
    )
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\PharmaCo360\GeneralItemsController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        );

        Route::get(
            '/categories',
            [$controller, 'tenantCategories']
        );

        Route::post(
            '/categories',
            [$controller, 'storeCategory']
        );

        Route::put(
            '/categories/{categoryId}',
            [$controller, 'tenantUpdateCategory']
        );

        Route::get(
            '/items',
            [$controller, 'tenantItems']
        );

        Route::post(
            '/items',
            [$controller, 'storeItem']
        );

        Route::put(
            '/items/{itemId}',
            [$controller, 'tenantUpdateItem']
        );

        Route::get(
            '/locations',
            [$controller, 'tenantLocations']
        );

        Route::post(
            '/locations',
            [$controller, 'storeLocation']
        );

        Route::get(
            '/stock',
            [$controller, 'tenantStock']
        );

        Route::get(
            '/movements',
            [$controller, 'tenantMovements']
        );

        Route::post(
            '/receiving',
            [$controller, 'tenantReceive']
        );

        Route::post(
            '/usage',
            [$controller, 'tenantIssue']
        );
    });

/*
|--------------------------------------------------------------------------
| AQUILA_GENERAL_ITEMS_OPERATIONAL_ROUTES_END
|--------------------------------------------------------------------------
*/

require __DIR__ . '/handover.php';

require __DIR__ . '/accounting.php';

// BEGIN AQUILA_IF1_B1_READ_ONLY_INVENTORY_FINANCE
/*
 * IF1-B1 Inventory Finance
 * GET-only authenticated read model.
 * No inventory writes.
 * No Finance posting.
 */
\Illuminate\Support\Facades\Route::middleware('auth:sanctum')
    ->get(
        '/v1/pharmaco/finance/inventory/read-model',
        [
            \App\Http\Controllers\Api\V1\Pharmaco\Finance\InventoryFinanceReadModelController::class,
            'index'
        ]
    )
    ->name('pharmaco.finance.inventory.read-model');
// END AQUILA_IF1_B1_READ_ONLY_INVENTORY_FINANCE

// BEGIN AQUILA_IF2_B1_R3_COST_PROVENANCE_RESOLUTION
\Illuminate\Support\Facades\Route::middleware([
    'auth:sanctum',
    'permission:pharmaco.inventory.manage',
    'permission:inventory.batches.edit',
    'tenant.module:pharmaco.inventory',
])
    ->patch(
        '/v1/pharmaco/finance/inventory/exceptions/cost-provenance/{batch}',
        [
            \App\Http\Controllers\Api\V1\Pharmaco\Finance\InventoryFinanceCostProvenanceResolutionController::class,
            'update',
        ]
    )
    ->whereNumber('batch')
    ->name(
        'pharmaco.finance.inventory.exceptions.cost-provenance.update'
    );
// END AQUILA_IF2_B1_R3_COST_PROVENANCE_RESOLUTION

// BEGIN AQUILA_HRM_B1_B_SECURE_API
/*
 * Human Resources B1-B
 *
 * Authentication and permission middleware are enforced here.
 * Tenant and branch scope are enforced by the controller service.
 *
 * Payroll calculation and Finance posting are intentionally absent.
 */
\Illuminate\Support\Facades\Route::prefix('v1/hrm')
    ->middleware('auth:sanctum')
    ->group(function (): void {

        \Illuminate\Support\Facades\Route::get(
            '/overview',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'overview'
            ]
        )
            ->middleware('permission:hrm.view')
            ->name('hrm.overview');

        \Illuminate\Support\Facades\Route::get(
            '/organization',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'organization'
            ]
        )
            ->middleware('permission:hrm.organization.view')
            ->name('hrm.organization.index');

        \Illuminate\Support\Facades\Route::post(
            '/job-grades',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeJobGrade'
            ]
        )
            ->middleware('permission:hrm.organization.manage')
            ->name('hrm.job-grades.store');

        \Illuminate\Support\Facades\Route::post(
            '/positions',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storePosition'
            ]
        )
            ->middleware('permission:hrm.organization.manage')
            ->name('hrm.positions.store');

        \Illuminate\Support\Facades\Route::get(
            '/employees',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'employees'
            ]
        )
            ->middleware('permission:hrm.employee.view')
            ->name('hrm.employees.index');

        \Illuminate\Support\Facades\Route::post(
            '/employees',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeEmployee'
            ]
        )
            ->middleware('permission:hrm.employee.manage')
            ->name('hrm.employees.store');

        \Illuminate\Support\Facades\Route::get(
            '/employees/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'showEmployee'
            ]
        )
            ->whereNumber('employeeId')
            ->middleware('permission:hrm.employee.view')
            ->name('hrm.employees.show');

        \Illuminate\Support\Facades\Route::patch(
            '/employees/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'updateEmployee'
            ]
        )
            ->whereNumber('employeeId')
            ->middleware('permission:hrm.employee.manage')
            ->name('hrm.employees.update');

        \Illuminate\Support\Facades\Route::get(
            '/contracts',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'contracts'
            ]
        )
            ->middleware('permission:hrm.contract.view')
            ->name('hrm.contracts.index');

        \Illuminate\Support\Facades\Route::post(
            '/contracts',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeContract'
            ]
        )
            ->middleware('permission:hrm.contract.manage')
            ->name('hrm.contracts.store');

        \Illuminate\Support\Facades\Route::patch(
            '/contracts/{contractId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'updateContract'
            ]
        )
            ->whereNumber('contractId')
            ->middleware('permission:hrm.contract.manage')
            ->name('hrm.contracts.update');

        \Illuminate\Support\Facades\Route::get(
            '/compensations',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'compensations'
            ]
        )
            ->middleware('permission:hrm.compensation.view')
            ->name('hrm.compensations.index');

        \Illuminate\Support\Facades\Route::post(
            '/compensations',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeCompensation'
            ]
        )
            ->middleware('permission:hrm.compensation.manage')
            ->name('hrm.compensations.store');

        \Illuminate\Support\Facades\Route::post(
            '/compensations/{compensationId}/approve',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'approveCompensation'
            ]
        )
            ->whereNumber('compensationId')
            ->middleware('permission:hrm.compensation.approve')
            ->name('hrm.compensations.approve');

        \Illuminate\Support\Facades\Route::get(
            '/credentials',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'credentials'
            ]
        )
            ->middleware('permission:hrm.credential.view')
            ->name('hrm.credentials.index');

        \Illuminate\Support\Facades\Route::post(
            '/credentials',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeCredential'
            ]
        )
            ->middleware('permission:hrm.credential.manage')
            ->name('hrm.credentials.store');

        \Illuminate\Support\Facades\Route::get(
            '/documents',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'documents'
            ]
        )
            ->middleware('permission:hrm.document.view')
            ->name('hrm.documents.index');

        \Illuminate\Support\Facades\Route::post(
            '/documents/metadata',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'storeDocumentMetadata'
            ]
        )
            ->middleware('permission:hrm.document.manage')
            ->name('hrm.documents.metadata.store');
    });
// END AQUILA_HRM_B1_B_SECURE_API


/* AQUILA_INVENTORY_ERROR_HYGIENE_R1_R1_BEGIN */

Route::middleware('auth:sanctum')
    ->prefix('v1/pharmaco')
    ->group(function () {

        Route::get(
            '/inventory/stock-movements',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController::class,
                'stockMovements',
            ]
        )->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

        Route::get(
            '/reports/sales-register',
            [
                \App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController::class,
                'sales',
            ]
        )->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);
    });

/* AQUILA_INVENTORY_ERROR_HYGIENE_R1_R1_END */


/*
 * AQUILA_HRM_B2A_OPERATIONAL_ROUTES_R1_R4
 *
 * Isolated authenticated B2-A extension.
 * Existing HRM routes are not rewritten.
 */
Route::middleware('auth:sanctum')
    ->prefix('v1/hrm')
    ->group(function () {

        Route::post(
            '/b2/departments',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2StoreDepartment',
            ]
        )
            ->middleware(
                'permission:hrm.organization.manage'
            )
            ->name(
                'hrm.b2.departments.store'
            );

        Route::put(
            '/b2/departments/{departmentId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2UpdateDepartment',
            ]
        )
            ->middleware(
                'permission:hrm.organization.manage'
            )
            ->name(
                'hrm.b2.departments.update'
            );

        Route::put(
            '/b2/job-grades/{jobGradeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2UpdateJobGrade',
            ]
        )
            ->middleware(
                'permission:hrm.organization.manage'
            )
            ->name(
                'hrm.b2.job-grades.update'
            );

        Route::put(
            '/b2/positions/{positionId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2UpdatePosition',
            ]
        )
            ->middleware(
                'permission:hrm.organization.manage'
            )
            ->name(
                'hrm.b2.positions.update'
            );

        Route::get(
            '/b2/employees/{employeeId}/edit',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2EmployeeEdit',
            ]
        )
            ->middleware(
                'permission:hrm.employee.manage'
            )
            ->name(
                'hrm.b2.employees.edit'
            );

        Route::put(
            '/b2/employees/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2UpdateEmployee',
            ]
        )
            ->middleware(
                'permission:hrm.employee.manage'
            )
            ->name(
                'hrm.b2.employees.update'
            );

        Route::delete(
            '/b2/employees/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2ArchiveEmployee',
            ]
        )
            ->middleware(
                'permission:hrm.employee.manage'
            )
            ->name(
                'hrm.b2.employees.archive'
            );

        Route::get(
            '/b2/compensations/{compensationId}/review',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'b2CompensationReview',
            ]
        )
            ->middleware(
                'permission:hrm.compensation.approve'
            )
            ->name(
                'hrm.b2.compensations.review'
            );

    });


/*
 * BEGIN AQUILA_HRM_B2B_ADVANCED_PAYROLL_ENGINE_R1_R2
 *
 * TEST-only additive payroll domain.
 * Existing HRM routes are not rewritten.
 * Finance posting is intentionally absent.
 */
Route::middleware([
    'auth:sanctum',
])
    ->prefix(
        'v1/hrm/b2/payroll'
    )
    ->group(function () {

        Route::get(
            '/overview',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'overview',
            ]
        )->middleware(
            'permission:hrm.compensation.view'
        );


        Route::get(
            '/statutory-rules',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'statutoryRules',
            ]
        )->middleware(
            'permission:hrm.compensation.view'
        );


        Route::get(
            '/statutory-profiles/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'statutoryProfile',
            ]
        )->middleware(
            'permission:hrm.employee.sensitive.view'
        );


        Route::put(
            '/statutory-profiles/{employeeId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'updateStatutoryProfile',
            ]
        )->middleware([
            'permission:hrm.employee.sensitive.manage',
            'permission:hrm.compensation.manage',
        ]);


        Route::post(
            '/periods',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'createPeriod',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );


        Route::post(
            '/runs',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'createRun',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );


        Route::get(
            '/runs/{runId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'showRun',
            ]
        )->middleware(
            'permission:hrm.compensation.view'
        );


        Route::post(
            '/runs/{runId}/prepare',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'prepareRun',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );


        Route::put(
            '/runs/{runId}/employees/{runEmployeeId}/inputs',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'updateEmployeeInputs',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );


        Route::post(
            '/runs/{runId}/submit',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'submitRun',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );


        Route::post(
            '/runs/{runId}/reject',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'rejectRun',
            ]
        )->middleware(
            'permission:hrm.compensation.approve'
        );


        Route::post(
            '/runs/{runId}/approve',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollEngineController::class,
                'approveRun',
            ]
        )->middleware(
            'permission:hrm.compensation.approve'
        )
            ->middleware(\App\Http\Middleware\Hrm\EnsurePayrollComplianceReady::class);
    });

/* END AQUILA_HRM_B2B_ADVANCED_PAYROLL_ENGINE_R1_R2 */

// AQUILA_HRM_COMPENSATION_REVIEW_R3_R2_ROUTES_START

Route::middleware([
    'auth:sanctum',
])
    ->prefix('v1/hrm/b2')
    ->group(function () {
        Route::patch(
            '/compensations/{compensationId}',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'updateCompensationDraft',
            ]
        )
            ->middleware(
                'permission:hrm.compensation.manage'
            )
            ->name(
                'hrm.b2.compensations.update'
            );

        /* AQUILA_HRM_PAYROLL_R6_SALARY_CHANGE_ROUTE */
        Route::post(
            '/compensations/{compensationId}/change',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'createCompensationChange',
            ]
        )->middleware([
            'auth:sanctum',
            'permission:hrm.compensation.manage',
        ])->name(
            'hrm.b2.compensations.salary-change'
        );

        Route::post(
            '/compensations/{compensationId}/reject',
            [
                \App\Http\Controllers\Api\V1\Hrm\HrmFoundationController::class,
                'rejectCompensationDraft',
            ]
        )
            ->middleware(
                'permission:hrm.compensation.approve'
            )
            ->name(
                'hrm.b2.compensations.reject'
            );
    });

// AQUILA_HRM_COMPENSATION_REVIEW_R3_R2_ROUTES_END



/* BEGIN AQUILA_HRM_B2C_COMMERCIAL_CLOSURE_R1 */

Route::middleware([
    'auth:sanctum',
])->prefix(
    'v1/hrm/b2/payroll'
)->group(function (): void {
    Route::get(
        '/runs/{runId}/closure',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'overview',
        ]
    )->middleware(
        'permission:hrm.compensation.view'
    );

    Route::get(
        '/runs/{runId}/compliance',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'compliance',
        ]
    )->middleware(
        'permission:hrm.compensation.view'
    );

    Route::get(
        '/runs/{runId}/payslips',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'payslips',
        ]
    )->middleware(
        'permission:hrm.compensation.view'
    );

    Route::get(
        '/payment-profiles/{employeeId}',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'paymentProfile',
        ]
    )->middleware(
        'permission:hrm.employee.sensitive.view'
    );

    Route::put(
        '/payment-profiles/{employeeId}',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'updatePaymentProfile',
        ]
    )->middleware([
        'permission:hrm.employee.sensitive.manage',
        'permission:hrm.compensation.manage',
    ]);

    Route::post(
        '/runs/{runId}/exports/ishema',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'generateIshemaExport',
        ]
    )->middleware(
        'permission:hrm.compensation.approve'
    );

    Route::get(
        '/exports/{exportId}',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'downloadExport',
        ]
    )->middleware(
        'permission:hrm.compensation.view'
    );

    Route::post(
        '/runs/{runId}/declarations',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'recordDeclaration',
        ]
    )->middleware(
        'permission:hrm.compensation.approve'
    );

    Route::post(
        '/runs/{runId}/payments',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'recordPayment',
        ]
    )->middleware(
        'permission:hrm.compensation.approve'
    );

    Route::post(
        '/runs/{runId}/payments/{paymentId}/reconcile',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'reconcilePayment',
        ]
    )->middleware(
        'permission:hrm.compensation.approve'
    );

    Route::post(
        '/runs/{runId}/close',
        [
            \App\Http\Controllers\Api\V1\Hrm\PayrollClosureController::class,
            'closeRun',
        ]
    )->middleware(
        'permission:hrm.compensation.approve'
    )
            ->middleware(\App\Http\Middleware\Hrm\EnsurePayrollFinanceReadyForClose::class);
});

/* END AQUILA_HRM_B2C_COMMERCIAL_CLOSURE_R1 */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B2 WORKFORCE OPERATIONS
|--------------------------------------------------------------------------
| Time & Attendance + Leave Management.
| No Payroll recalculation and no Finance posting.
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b2/workforce')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\WorkforceOperationsController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware(
            'permission:hrm.view'
        );

        Route::get(
            '/employees',
            [$controller, 'employees']
        )->middleware(
            'permission:hrm.view'
        );

        Route::get(
            '/shift-templates',
            [$controller, 'shiftTemplates']
        )->middleware(
            'permission:hrm.attendance.view'
        );

        Route::post(
            '/shift-templates',
            [$controller, 'createShiftTemplate']
        )->middleware(
            'permission:hrm.attendance.manage'
        );

        Route::get(
            '/shift-assignments',
            [$controller, 'shiftAssignments']
        )->middleware(
            'permission:hrm.attendance.view'
        );

        Route::post(
            '/shift-assignments',
            [$controller, 'createShiftAssignment']
        )->middleware(
            'permission:hrm.attendance.manage'
        );

        Route::get(
            '/attendance',
            [$controller, 'attendance']
        )->middleware(
            'permission:hrm.attendance.view'
        );

        Route::post(
            '/attendance',
            [$controller, 'createAttendance']
        )->middleware(
            'permission:hrm.attendance.manage'
        );

        Route::post(
            '/attendance/{attendanceId}/submit',
            [$controller, 'submitAttendance']
        )->middleware(
            'permission:hrm.attendance.manage'
        );

        Route::post(
            '/attendance/{attendanceId}/approve',
            [$controller, 'approveAttendance']
        )->middleware(
            'permission:hrm.attendance.approve'
        );

        Route::post(
            '/attendance/{attendanceId}/reject',
            [$controller, 'rejectAttendance']
        )->middleware(
            'permission:hrm.attendance.approve'
        );

        Route::get(
            '/overtime',
            [$controller, 'overtime']
        )->middleware(
            'permission:hrm.attendance.view'
        );

        Route::post(
            '/overtime',
            [$controller, 'createOvertime']
        )->middleware(
            'permission:hrm.attendance.manage'
        );

        Route::post(
            '/overtime/{overtimeId}/approve',
            [$controller, 'approveOvertime']
        )->middleware(
            'permission:hrm.attendance.approve'
        );

        Route::post(
            '/overtime/{overtimeId}/reject',
            [$controller, 'rejectOvertime']
        )->middleware(
            'permission:hrm.attendance.approve'
        );

        Route::get(
            '/leave-types',
            [$controller, 'leaveTypes']
        )->middleware(
            'permission:hrm.leave.view'
        );

        Route::post(
            '/leave-types',
            [$controller, 'createLeaveType']
        )->middleware(
            'permission:hrm.leave.manage'
        );

        Route::get(
            '/leave-policies',
            [$controller, 'leavePolicies']
        )->middleware(
            'permission:hrm.leave.view'
        );

        Route::post(
            '/leave-policies',
            [$controller, 'createLeavePolicy']
        )->middleware(
            'permission:hrm.leave.manage'
        );

        Route::get(
            '/leave-balances',
            [$controller, 'leaveBalances']
        )->middleware(
            'permission:hrm.leave.view'
        );

        Route::post(
            '/leave-balances',
            [$controller, 'createLeaveBalance']
        )->middleware(
            'permission:hrm.leave.manage'
        );

        Route::get(
            '/leave-requests',
            [$controller, 'leaveRequests']
        )->middleware(
            'permission:hrm.leave.view'
        );

        Route::post(
            '/leave-requests',
            [$controller, 'createLeaveRequest']
        )->middleware(
            'permission:hrm.leave.manage'
        );

        Route::post(
            '/leave-requests/{leaveRequestId}/submit',
            [$controller, 'submitLeaveRequest']
        )->middleware(
            'permission:hrm.leave.manage'
        );

        Route::post(
            '/leave-requests/{leaveRequestId}/approve',
            [$controller, 'approveLeaveRequest']
        )->middleware(
            'permission:hrm.leave.approve'
        );

        Route::post(
            '/leave-requests/{leaveRequestId}/reject',
            [$controller, 'rejectLeaveRequest']
        )->middleware(
            'permission:hrm.leave.approve'
        );
    });
/* END AQUILA HRM-B2 WORKFORCE OPERATIONS */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B5 SELF SERVICE
|--------------------------------------------------------------------------
| Own-data routes:
|   authenticated + tenant/scope + signed-in user -> employee mapping.
|
| Manager actions:
|   explicit self-service permission + direct-report boundary.
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b5/self-service')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\SelfServiceController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        );

        Route::post(
            '/profile-change-requests',
            [$controller, 'requestProfileChange']
        );

        Route::get(
            '/manager/queue',
            [$controller, 'managerQueue']
        )->middleware(
            'permission:hrm.self_service.manage'
        );

        Route::post(
            '/manager/profile-change-requests/{requestId}/approve',
            [$controller, 'approveProfileChange']
        )->middleware(
            'permission:hrm.self_service.approve'
        );

        Route::post(
            '/manager/profile-change-requests/{requestId}/reject',
            [$controller, 'rejectProfileChange']
        )->middleware(
            'permission:hrm.self_service.approve'
        );
    });

/* END AQUILA HRM-B5 SELF SERVICE */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B6 RECRUITMENT ONBOARDING
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b6/recruitment')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\RecruitmentOnboardingController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware([
            'permission:hrm.recruitment.view',
            'permission:hrm.onboarding.view',
        ]);

        Route::post(
            '/requisitions',
            [$controller, 'createRequisition']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/requisitions/{requisitionId}/submit',
            [$controller, 'submitRequisition']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/requisitions/{requisitionId}/approve',
            [$controller, 'approveRequisition']
        )->middleware(
            'permission:hrm.recruitment.approve'
        );

        Route::post(
            '/requisitions/{requisitionId}/reject',
            [$controller, 'rejectRequisition']
        )->middleware(
            'permission:hrm.recruitment.approve'
        );

        Route::post(
            '/vacancies',
            [$controller, 'createVacancy']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/candidates',
            [$controller, 'createCandidate']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/applications',
            [$controller, 'createApplication']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/applications/{applicationId}/stage',
            [$controller, 'moveApplication']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/interviews',
            [$controller, 'scheduleInterview']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/interviews/{interviewId}/complete',
            [$controller, 'completeInterview']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/offers',
            [$controller, 'createOffer']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/offers/{offerId}/submit',
            [$controller, 'submitOffer']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/offers/{offerId}/approve',
            [$controller, 'approveOffer']
        )->middleware(
            'permission:hrm.recruitment.approve'
        );

        Route::post(
            '/offers/{offerId}/reject',
            [$controller, 'rejectOffer']
        )->middleware(
            'permission:hrm.recruitment.approve'
        );

        Route::post(
            '/offers/{offerId}/accept',
            [$controller, 'acceptOffer']
        )->middleware(
            'permission:hrm.recruitment.manage'
        );

        Route::post(
            '/applications/{applicationId}/hire',
            [$controller, 'hire']
        )->middleware(
            'permission:hrm.recruitment.approve'
        );

        Route::post(
            '/onboarding/tasks',
            [$controller, 'createOnboardingTask']
        )->middleware(
            'permission:hrm.onboarding.manage'
        );

        Route::post(
            '/onboarding/tasks/{taskId}/complete',
            [$controller, 'completeOnboardingTask']
        )->middleware(
            'permission:hrm.onboarding.manage'
        );

        Route::post(
            '/onboarding/tasks/{taskId}/verify',
            [$controller, 'verifyOnboardingTask']
        )->middleware(
            'permission:hrm.onboarding.approve'
        );

        Route::post(
            '/onboarding/plans/{planId}/complete',
            [$controller, 'completeOnboardingPlan']
        )->middleware(
            'permission:hrm.onboarding.approve'
        );
    });

/* END AQUILA HRM-B6 RECRUITMENT ONBOARDING */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B7 PERFORMANCE LEARNING
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b7/performance-learning')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\PerformanceLearningController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware([
            'permission:hrm.performance.view',
            'permission:hrm.learning.view',
        ]);

        Route::post(
            '/cycles',
            [$controller, 'createCycle']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/cycles/{cycleId}/submit',
            [$controller, 'submitCycle']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/cycles/{cycleId}/approve',
            [$controller, 'approveCycle']
        )->middleware(
            'permission:hrm.performance.approve'
        );

        Route::post(
            '/goals',
            [$controller, 'createGoal']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/goals/{goalId}/progress',
            [$controller, 'updateGoal']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/reviews',
            [$controller, 'createReview']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/reviews/{reviewId}/competencies',
            [$controller, 'assessCompetency']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/reviews/{reviewId}/submit',
            [$controller, 'submitReview']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/reviews/{reviewId}/approve',
            [$controller, 'approveReview']
        )->middleware(
            'permission:hrm.performance.approve'
        );

        Route::post(
            '/development-plans',
            [$controller, 'createDevelopmentPlan']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/development-plans/{planId}/progress',
            [$controller, 'updateDevelopmentPlan']
        )->middleware(
            'permission:hrm.performance.manage'
        );

        Route::post(
            '/courses',
            [$controller, 'createCourse']
        )->middleware(
            'permission:hrm.learning.manage'
        );

        Route::post(
            '/enrollments',
            [$controller, 'enroll']
        )->middleware(
            'permission:hrm.learning.manage'
        );

        Route::post(
            '/enrollments/{enrollmentId}/complete',
            [$controller, 'completeEnrollment']
        )->middleware(
            'permission:hrm.learning.manage'
        );

        Route::post(
            '/certifications',
            [$controller, 'issueCertification']
        )->middleware(
            'permission:hrm.learning.approve'
        );
    });

/* END AQUILA HRM-B7 PERFORMANCE LEARNING */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B8 EMPLOYEE RELATIONS OFFBOARDING
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b8/relations-offboarding')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\EmployeeRelationsOffboardingController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware([
            'permission:hrm.employee_relations.view',
            'permission:hrm.offboarding.view',
        ]);

        Route::post(
            '/relations/cases',
            [$controller, 'createRelationCase']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/cases/{caseId}/submit',
            [$controller, 'submitRelationCase']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/cases/{caseId}/approve',
            [$controller, 'approveRelationCase']
        )->middleware(
            'permission:hrm.employee_relations.approve'
        );

        Route::post(
            '/relations/cases/{caseId}/notes',
            [$controller, 'addRelationNote']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/cases/{caseId}/actions',
            [$controller, 'createRelationAction']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/actions/{actionId}/complete',
            [$controller, 'completeRelationAction']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/cases/{caseId}/hearings',
            [$controller, 'scheduleHearing']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/hearings/{hearingId}/complete',
            [$controller, 'completeHearing']
        )->middleware(
            'permission:hrm.employee_relations.manage'
        );

        Route::post(
            '/relations/cases/{caseId}/close',
            [$controller, 'closeRelationCase']
        )->middleware(
            'permission:hrm.employee_relations.approve'
        );

        Route::post(
            '/offboarding/cases',
            [$controller, 'createOffboarding']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/cases/{offboardingId}/submit',
            [$controller, 'submitOffboarding']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/cases/{offboardingId}/approve',
            [$controller, 'approveOffboarding']
        )->middleware(
            'permission:hrm.offboarding.approve'
        );

        Route::post(
            '/offboarding/cases/{offboardingId}/reject',
            [$controller, 'rejectOffboarding']
        )->middleware(
            'permission:hrm.offboarding.approve'
        );

        Route::post(
            '/offboarding/clearance',
            [$controller, 'createClearanceItem']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/clearance/{clearanceId}/complete',
            [$controller, 'completeClearanceItem']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/clearance/{clearanceId}/verify',
            [$controller, 'verifyClearanceItem']
        )->middleware(
            'permission:hrm.offboarding.approve'
        );

        Route::post(
            '/offboarding/exit-interviews',
            [$controller, 'recordExitInterview']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/access-actions',
            [$controller, 'createAccessAction']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/access-actions/{accessActionId}/complete',
            [$controller, 'completeAccessAction']
        )->middleware(
            'permission:hrm.offboarding.manage'
        );

        Route::post(
            '/offboarding/cases/{offboardingId}/finalise',
            [$controller, 'finaliseOffboarding']
        )->middleware(
            'permission:hrm.offboarding.approve'
        );
    });

/* END AQUILA HRM-B8 EMPLOYEE RELATIONS OFFBOARDING */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B9 ANALYTICS REPORTING
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b9/analytics')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\HrAnalyticsController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::get(
            '/workforce',
            [$controller, 'workforce']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::get(
            '/operations',
            [$controller, 'operations']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::get(
            '/talent',
            [$controller, 'talent']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::get(
            '/reports',
            [$controller, 'reports']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::post(
            '/reports',
            [$controller, 'createReport']
        )->middleware(
            'permission:hrm.analytics.manage'
        );

        Route::post(
            '/reports/{reportId}',
            [$controller, 'updateReport']
        )->middleware(
            'permission:hrm.analytics.manage'
        );

        Route::post(
            '/reports/{reportId}/archive',
            [$controller, 'archiveReport']
        )->middleware(
            'permission:hrm.analytics.manage'
        );

        Route::get(
            '/snapshots',
            [$controller, 'snapshots']
        )->middleware(
            'permission:hrm.analytics.view'
        );

        Route::post(
            '/snapshots',
            [$controller, 'captureSnapshot']
        )->middleware(
            'permission:hrm.analytics.snapshot'
        );

        Route::get(
            '/export/{dataset}',
            [$controller, 'export']
        )->middleware(
            'permission:hrm.analytics.export'
        );
    });

/* END AQUILA HRM-B9 ANALYTICS REPORTING */

/*
|--------------------------------------------------------------------------
| AQUILA HRM-B10 PHARMACY WORKFORCE
|--------------------------------------------------------------------------
*/
Route::prefix('v1/hrm/b10/pharmacy-workforce')
    ->middleware(['auth:sanctum'])
    ->group(function (): void {
        $controller =
            \App\Http\Controllers\Api\V1\Hrm\PharmacyWorkforceController::class;

        Route::get(
            '/overview',
            [$controller, 'overview']
        )->middleware([
            'permission:hrm.pharmacy_workforce.view',
            'permission:hrm.pharmacy_compliance.view',
        ]);

        Route::post(
            '/authorizations',
            [$controller, 'createAuthorization']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/authorizations/{authorizationId}/submit',
            [$controller, 'submitAuthorization']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/authorizations/{authorizationId}/approve',
            [$controller, 'approveAuthorization']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/authorizations/{authorizationId}/reject',
            [$controller, 'rejectAuthorization']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/authorizations/{authorizationId}/end',
            [$controller, 'endAuthorization']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/responsible-assignments',
            [$controller, 'createResponsibleAssignment']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/responsible-assignments/{assignmentId}/submit',
            [$controller, 'submitResponsibleAssignment']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/responsible-assignments/{assignmentId}/approve',
            [$controller, 'approveResponsibleAssignment']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/responsible-assignments/{assignmentId}/reject',
            [$controller, 'rejectResponsibleAssignment']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/responsible-assignments/{assignmentId}/end',
            [$controller, 'endResponsibleAssignment']
        )->middleware(
            'permission:hrm.pharmacy_workforce.approve'
        );

        Route::post(
            '/coverage-requirements',
            [$controller, 'createCoverageRequirement']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/coverage-requirements/{requirementId}/end',
            [$controller, 'endCoverageRequirement']
        )->middleware(
            'permission:hrm.pharmacy_workforce.manage'
        );

        Route::post(
            '/compliance-exceptions',
            [$controller, 'createException']
        )->middleware(
            'permission:hrm.pharmacy_compliance.manage'
        );

        Route::post(
            '/compliance-exceptions/{exceptionId}/resolve',
            [$controller, 'resolveException']
        )->middleware(
            'permission:hrm.pharmacy_compliance.manage'
        );
    });

/* END AQUILA HRM-B10 PHARMACY WORKFORCE */


/*
|--------------------------------------------------------------------------
| AQUILA_PAYROLL_CONTROL_CENTER_COMPLETE_R1
|--------------------------------------------------------------------------
|
| TEST-only product-control routes.
| Existing Payroll engine and approval routes remain authoritative.
|
*/
\Illuminate\Support\Facades\Route::middleware(
    'auth:sanctum'
)
    ->prefix('v1/hrm/b2/payroll')
    ->group(function (): void {

        \Illuminate\Support\Facades\Route::get(
            '/runs/{runId}/employee-pay-setup',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'employeePaySetup',
            ]
        )->middleware(
            'permission:hrm.compensation.view'
        );

        \Illuminate\Support\Facades\Route::get(
            '/regulatory-control',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'regulatoryControl',
            ]
        )->middleware(
            'permission:hrm.compensation.view'
        );

        \Illuminate\Support\Facades\Route::post(
            '/regulatory-changes',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'createRegulatoryChange',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );

        \Illuminate\Support\Facades\Route::post(
            '/regulatory-changes/{uuid}/submit',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'submitRegulatoryChange',
            ]
        )->middleware(
            'permission:hrm.compensation.manage'
        );

        \Illuminate\Support\Facades\Route::post(
            '/regulatory-changes/{uuid}/approve',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'approveRegulatoryChange',
            ]
        )->middleware(
            'permission:hrm.compensation.approve'
        );

        \Illuminate\Support\Facades\Route::get(
            '/runs/{runId}/finance-control',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'financeControl',
            ]
        )->middleware([
            'permission:hrm.compensation.view',
            'permission:finance.expenses.view',
        ]);

        \Illuminate\Support\Facades\Route::post(
            '/finance-mappings',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'createFinanceMapping',
            ]
        )->middleware([
            'permission:hrm.compensation.manage',
            'permission:finance.expenses.create',
        ]);

        \Illuminate\Support\Facades\Route::post(
            '/finance-mappings/{uuid}/submit',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'submitFinanceMapping',
            ]
        )->middleware([
            'permission:hrm.compensation.manage',
            'permission:finance.expenses.create',
        ]);

        \Illuminate\Support\Facades\Route::post(
            '/finance-mappings/{uuid}/approve',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'approveFinanceMapping',
            ]
        )->middleware([
            'permission:hrm.compensation.approve',
            'permission:finance.expenses.approve',
        ]);

        \Illuminate\Support\Facades\Route::post(
            '/runs/{runId}/finance-expense',
            [
                \App\Http\Controllers\Api\V1\Hrm\PayrollControlCenterR1Controller::class,
                'prepareFinanceExpense',
            ]
        )->middleware([
            'permission:hrm.compensation.manage',
            'permission:finance.expenses.create',
        ]);
    });

/* AQUILA_PAYROLL_CONTROL_CENTER_COMPLETE_R1_END */


/* AQUILA_FINANCE_PLANNING_PERFORMANCE_P1A_R2 */
if (is_file(__DIR__ . '/finance_planning.php')) {
    require __DIR__ . '/finance_planning.php';
}
