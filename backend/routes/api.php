<?php

use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PlatformStatusController;
use App\Http\Controllers\Api\V1\SolutionController;
use App\Http\Controllers\Api\V1\TenantPublicStatusController;
use App\Http\Controllers\Api\V1\PharmaCo360\CoreProfileController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProductInventoryController;
use App\Http\Controllers\Api\V1\PharmaCo360\ProcurementController;
use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/health', HealthController::class);
    Route::get('/platform/status', PlatformStatusController::class);
    Route::get('/solutions', [SolutionController::class, 'index']);
    Route::get('/tenants/{slug}/public-status', [TenantPublicStatusController::class, 'show']);
});


Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [\App\Http\Controllers\Api\V1\AuthController::class, 'me']);
        Route::post('/logout', [\App\Http\Controllers\Api\V1\AuthController::class, 'logout']);
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

Route::middleware('auth:sanctum')->prefix('v1/pharmaco')->group(function () {


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

