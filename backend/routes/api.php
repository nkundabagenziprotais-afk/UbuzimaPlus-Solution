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
use App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProcurementController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReportingController;
use App\Http\Controllers\Api\V1\PharmaCo360\ReceivablesController;
use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
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
        Route::get('/two-factor/status', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'status']);
        Route::post('/two-factor/setup', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'setup']);
        Route::post('/two-factor/recovery-codes', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'recoveryCodes']);
        Route::delete('/two-factor/trusted-devices/{trustedDevice}', [\App\Http\Controllers\Api\V1\TwoFactorController::class, 'revokeTrustedDevice']);
    });
});


Route::middleware('auth:sanctum')->prefix('v1/access-check')->group(function () {
    Route::get('/security', [\App\Http\Controllers\Api\V1\AccessCheckController::class, 'securitySummary'])
        ->middleware('permission:roles.manage');

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
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/reports/payables-summary', [ReportingController::class, 'payablesSummary'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
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
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::get('/supplier-invoices', [ProcurementController::class, 'supplierInvoices'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices', [ProcurementController::class, 'createSupplierInvoice'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/supplier-invoices/{supplierInvoice}', [ProcurementController::class, 'supplierInvoice'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices/{supplierInvoice}/approve', [ProcurementController::class, 'approveSupplierInvoice'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/supplier-invoices/{supplierInvoice}/payments', [ProcurementController::class, 'recordSupplierPayment'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::get('/suppliers', [ProcurementController::class, 'suppliers'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::patch('/suppliers/{supplier}', [ProcurementController::class, 'updateSupplier'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/purchase-orders/{purchaseOrder}/approve', [ProcurementController::class, 'approvePurchaseOrder'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::post('/purchase-orders/{purchaseOrder}/cancel', [ProcurementController::class, 'cancelPurchaseOrder'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);


    Route::post('/purchase-orders', [ProcurementController::class, 'createPurchaseOrder'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/purchase-orders', [ProcurementController::class, 'purchaseOrders'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
            'tenant.module:pharmaco.suppliers',
        ]);

    Route::get('/purchase-orders/{purchaseOrder}', [ProcurementController::class, 'purchaseOrder'])
        ->middleware([
            'permission:pharmaco.suppliers.manage',
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
            'permission:pharmaco.inventory.manage',
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
            'permission:pharmaco.inventory.manage',
            'tenant.module:pharmaco.inventory',
        ]);

    Route::get('/inventory/locations', [ProductInventoryController::class, 'locations'])
        ->middleware([
            'permission:pharmaco.inventory.manage',
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

    Route::get('/inventory/batches', [ProductInventoryController::class, 'batches'])
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
            'permission:pharmaco.branches.manage',
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

    Route::get('/sales/{sale}', [SalesDispensingController::class, 'sale'])
        ->middleware([
            'permission:pharmaco.sales.manage',
            'tenant.module:pharmaco.sales',
        ]);


});
