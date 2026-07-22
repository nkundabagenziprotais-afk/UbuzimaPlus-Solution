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
use App\Http\Controllers\Api\V1\PharmaCo360\ReportingController;
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
        Route::patch('/pages/{page}', [PlatformContentController::class, 'updatePage']);
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
            'permission:pharmaco.procurement.suppliers.manage',
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
            'permission:pharmaco.procurement.view',
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

    Route::get('/inventory/summary', [ProductInventoryController::class, 'summary'])


    Route::get('/inventory/analytics-summary', function (\Illuminate\Http\Request $request) {
        $tenantSlug = $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->query('tenant_slug');

        $tenantId = null;

        if ($tenantSlug) {
            $tenantId = \Illuminate\Support\Facades\DB::table('tenants')
                ->where('slug', $tenantSlug)
                ->value('id');
        }

        if (!$tenantId && $request->user()) {
            $tenantId = $request->user()->tenant_id ?? null;
        }

        $startDate = $request->query('start_date')
            ?: $request->query('date_from')
            ?: now()->startOfMonth()->toDateString();

        $endDate = $request->query('end_date')
            ?: $request->query('date_to')
            ?: now()->toDateString();

        $batchBase = \Illuminate\Support\Facades\DB::table('stock_batches')
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->where(function ($query) {
                $query->whereNull('status')->orWhere('status', '!=', 'deleted');
            });

        $batchValueExpression = "COALESCE(quantity_on_hand, 0) * COALESCE(unit_cost, selling_price / 1.3, 0)";

        $totalInventoryValue = (clone $batchBase)->sum(\Illuminate\Support\Facades\DB::raw($batchValueExpression));
        $stockOnHandCount = (clone $batchBase)->sum(\Illuminate\Support\Facades\DB::raw('COALESCE(quantity_on_hand, 0)'));

        $lowStock = (clone $batchBase)
            ->whereRaw('COALESCE(quantity_on_hand, 0) > 0')
            ->whereRaw('COALESCE(quantity_on_hand, 0) <= 5');

        $lowStockValue = (clone $lowStock)->sum(\Illuminate\Support\Facades\DB::raw($batchValueExpression));
        $lowStockCount = (clone $lowStock)->count();

        $nearExpiry = (clone $batchBase)
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->whereDate('expiry_date', '<=', now()->addDays(180)->toDateString());

        $nearExpiryValue = (clone $nearExpiry)->sum(\Illuminate\Support\Facades\DB::raw($batchValueExpression));
        $nearExpiryCount = (clone $nearExpiry)->count();

        $expired = (clone $batchBase)
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString());

        $expiredValue = (clone $expired)->sum(\Illuminate\Support\Facades\DB::raw($batchValueExpression));
        $expiredCount = (clone $expired)->count();

        $movementBase = \Illuminate\Support\Facades\DB::table('stock_movements as m')
            ->leftJoin('stock_batches as b', 'b.id', '=', 'm.stock_batch_id')
            ->when($tenantId, fn ($query) => $query->where('m.tenant_id', $tenantId))
            ->whereDate(\Illuminate\Support\Facades\DB::raw('COALESCE(m.business_date, m.occurred_at, m.created_at)'), '>=', $startDate)
            ->whereDate(\Illuminate\Support\Facades\DB::raw('COALESCE(m.business_date, m.occurred_at, m.created_at)'), '<=', $endDate);

        $movementValueExpression = "ABS(COALESCE(m.quantity, 0)) * COALESCE(b.unit_cost, b.selling_price / 1.3, 0)";

        $receivedTypes = ['receive', 'received', 'purchase', 'stock_in', 'inbound', 'adjustment_in', 'return_in', 'opening'];
        $issuedTypes = ['issue', 'issued', 'sale', 'sold', 'dispense', 'stock_out', 'outbound', 'adjustment_out'];

        $receivedRows = (clone $movementBase)->whereIn('m.movement_type', $receivedTypes);
        $issuedRows = (clone $movementBase)->whereIn('m.movement_type', $issuedTypes);

        $stockReceivedValue = (clone $receivedRows)->sum(\Illuminate\Support\Facades\DB::raw($movementValueExpression));
        $stockReceivedCount = (clone $receivedRows)->count();

        $stockIssuedValue = (clone $issuedRows)->sum(\Illuminate\Support\Facades\DB::raw($movementValueExpression));
        $stockIssuedCount = (clone $issuedRows)->count();

        if ($stockReceivedValue <= 0 && $totalInventoryValue > 0) {
            $stockReceivedValue = $totalInventoryValue;
            $stockReceivedCount = (clone $batchBase)->count();
        }

        return response()->json([
            'total_inventory_value' => round((float) $totalInventoryValue, 2),
            'stock_on_hand_count' => round((float) $stockOnHandCount, 2),
            'stock_received_value' => round((float) $stockReceivedValue, 2),
            'stock_received_count' => (int) $stockReceivedCount,
            'stock_issued_value' => round((float) $stockIssuedValue, 2),
            'stock_issued_count' => (int) $stockIssuedCount,
            'low_stock_value' => round((float) $lowStockValue, 2),
            'low_stock_count' => (int) $lowStockCount,
            'near_expiry_value' => round((float) $nearExpiryValue, 2),
            'near_expiry_count' => (int) $nearExpiryCount,
            'expired_value' => round((float) $expiredValue, 2),
            'expired_count' => (int) $expiredCount,
            'turnover_value' => round((float) $stockIssuedValue, 2),
            'turnover_count' => (int) $stockIssuedCount,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    })->name('inventory.analytics-summary');
        ->middleware([
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

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
