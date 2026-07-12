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
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceMembershipController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceClaimController;
use App\Http\Controllers\Api\V1\PharmaCo360\InsuranceReconciliationController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProcurementController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReportingController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReceivablesController;
use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
use App\Http\Controllers\Api\V1\PharmaCo360\PosOperationsController;
use App\Http\Controllers\Api\V1\PharmaCo360\HistoricalPosApprovalController;
use App\Http\Controllers\Api\V1\PharmaCo360\HistoricalPosSessionController;
use Illuminate\Support\Facades\Route;

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
        ->middleware('permission:roles.manage');

    Route::post('/security/users', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'store'])
        ->middleware('permission:roles.manage');

    Route::put('/security/users/{user}', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'update'])
        ->middleware('permission:roles.manage');

    Route::delete('/security/users/{user}', [\App\Http\Controllers\Api\V1\TenantUserManagementController::class, 'deactivate'])
        ->middleware('permission:roles.manage');


    Route::get('/security/operations', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'summary'])
        ->middleware('permission:roles.manage');

    Route::post('/security/users/{user}/force-password-change', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'forcePasswordChange'])
        ->middleware('permission:roles.manage');

    Route::post('/security/users/{user}/reset-two-factor', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'resetTwoFactor'])
        ->middleware('permission:roles.manage');

    Route::post('/security/users/{user}/revoke-trusted-devices', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'revokeTrustedDevices'])
        ->middleware('permission:roles.manage');

    Route::post('/security/users/{user}/revoke-sessions', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'revokeSessions'])
        ->middleware('permission:roles.manage');

    Route::post('/security/users/{user}/status', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'updateStatus'])
        ->middleware('permission:roles.manage');


    Route::get('/security/audit-timeline', [\App\Http\Controllers\Api\V1\SecurityOperationsController::class, 'auditTimeline'])
        ->middleware('permission:roles.manage');

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
            'permission:pharmaco.sales.manage',
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
            'permission:pharmaco.insurance.manage',
            'tenant.module:pharmaco.insurance',
        ])
        ->group(function () {
            Route::post('/bootstrap', [
                InsuranceManagementController::class,
                'bootstrap',
            ]);

            Route::get('/partners', [
                InsuranceManagementController::class,
                'partners',
            ]);

            Route::post('/partners', [
                InsuranceManagementController::class,
                'createPartner',
            ]);

            Route::patch('/partners/{insurancePartner}', [
                InsuranceManagementController::class,
                'updatePartner',
            ]);

            Route::get('/schemes', [
                InsuranceManagementController::class,
                'schemes',
            ]);

            Route::post('/schemes', [
                InsuranceManagementController::class,
                'createScheme',
            ]);

            Route::get('/institutions', [
                InsuranceManagementController::class,
                'institutions',
            ]);

            Route::post('/institutions', [
                InsuranceManagementController::class,
                'createInstitution',
            ]);

            Route::patch('/institutions/{insuranceInstitution}', [
                InsuranceManagementController::class,
                'updateInstitution',
            ]);

            Route::patch('/schemes/{insuranceScheme}', [
                InsuranceManagementController::class,
                'updateScheme',
            ]);

            Route::get('/price-lists', [
                InsuranceManagementController::class,
                'priceLists',
            ]);

            Route::post('/price-lists', [
                InsuranceManagementController::class,
                'createPriceList',
            ]);

            Route::patch('/price-lists/{insurancePriceList}', [
                InsuranceManagementController::class,
                'updatePriceList',
            ]);

            Route::get('/product-prices', [
                InsuranceManagementController::class,
                'productPrices',
            ]);

            Route::post('/product-prices', [
                InsuranceManagementController::class,
                'upsertProductPrice',
            ]);

            Route::post('/product-prices/bulk-import', [
                InsuranceManagementController::class,
                'bulkImportProductPrices',
            ]);

            Route::get('/product-prices/export', [
                InsuranceManagementController::class,
                'exportProductPrices',
            ]);

            Route::get('/contribution-rules', [
                InsuranceManagementController::class,
                'contributionRules',
            ]);

            Route::post('/contribution-rules', [
                InsuranceManagementController::class,
                'createContributionRule',
            ]);

            Route::patch(
                '/contribution-rules/{insuranceContributionRule}',
                [
                    InsuranceManagementController::class,
                    'updateContributionRule',
                ]
            );

            Route::get('/memberships', [
                InsuranceMembershipController::class,
                'memberships',
            ]);

            Route::post('/memberships', [
                InsuranceMembershipController::class,
                'createMembership',
            ]);

            Route::patch(
                '/memberships/{customerInsuranceMembership}',
                [
                    InsuranceMembershipController::class,
                    'updateMembership',
                ]
            );

            Route::post(
                '/memberships/{customerInsuranceMembership}/eligibility',
                [
                    InsuranceMembershipController::class,
                    'checkEligibility',
                ]
            );

            Route::get('/claims', [
                InsuranceClaimController::class,
                'claims',
            ]);

            Route::post('/claims/from-sale', [
                InsuranceClaimController::class,
                'createFromSale',
            ]);

            Route::post(
                '/claims/{insuranceClaim}/submit',
                [
                    InsuranceClaimController::class,
                    'submitClaim',
                ]
            );

            Route::post(
                '/claims/{insuranceClaim}/adjudicate',
                [
                    InsuranceClaimController::class,
                    'adjudicateClaim',
                ]
            );

            Route::post(
                '/claims/{insuranceClaim}/payments',
                [
                    InsuranceClaimController::class,
                    'recordClaimPayment',
                ]
            );

            Route::get(
                '/reconciliation-batches',
                [
                    InsuranceReconciliationController::class,
                    'index',
                ]
            );

            Route::post(
                '/reconciliation-batches',
                [
                    InsuranceReconciliationController::class,
                    'store',
                ]
            );

            Route::get(
                '/reconciliation-batches/{insuranceReconciliationBatch}',
                [
                    InsuranceReconciliationController::class,
                    'show',
                ]
            );

            Route::post(
                '/reconciliation-batches/{insuranceReconciliationBatch}/submit',
                [
                    InsuranceReconciliationController::class,
                    'submit',
                ]
            );

            Route::get(
                '/reconciliation-batches/{insuranceReconciliationBatch}/eligible-payments',
                [
                    InsuranceReconciliationController::class,
                    'eligiblePayments',
                ]
            );

            Route::post(
                '/reconciliation-batches/{insuranceReconciliationBatch}/reconcile',
                [
                    InsuranceReconciliationController::class,
                    'reconcile',
                ]
            );

            Route::get('/claims/{insuranceClaim}', [
                InsuranceClaimController::class,
                'claim',
            ]);

            Route::post('/pricing/resolve', [
                InsuranceManagementController::class,
                'resolvePricing',
            ]);
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
            'permission:pharmaco.procurement.purchase_order.create',
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
            [$controller, 'categories']
        );

        Route::post(
            '/categories',
            [$controller, 'storeCategory']
        );

        Route::put(
            '/categories/{categoryId}',
            [$controller, 'updateCategory']
        );

        Route::get(
            '/items',
            [$controller, 'items']
        );

        Route::post(
            '/items',
            [$controller, 'storeItem']
        );

        Route::put(
            '/items/{itemId}',
            [$controller, 'updateItem']
        );

        Route::get(
            '/locations',
            [$controller, 'locations']
        );

        Route::post(
            '/locations',
            [$controller, 'storeLocation']
        );

        Route::get(
            '/stock',
            [$controller, 'stock']
        );

        Route::get(
            '/movements',
            [$controller, 'movements']
        );

        Route::post(
            '/receiving',
            [$controller, 'receive']
        );

        Route::post(
            '/usage',
            [$controller, 'issue']
        );
    });

/*
|--------------------------------------------------------------------------
| AQUILA_GENERAL_ITEMS_OPERATIONAL_ROUTES_END
|--------------------------------------------------------------------------
*/
