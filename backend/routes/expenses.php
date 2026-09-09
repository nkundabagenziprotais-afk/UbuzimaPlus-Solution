<?php

/*
|--------------------------------------------------------------------------
| AQUILA_EXPENSE_ITEMS_R1_ROUTES
|--------------------------------------------------------------------------
| Controlled Expense Item master and contribution reporting.
| Existing Expense approval, posting, reverse, maker/checker and accounting
| controls remain unchanged.
*/
\Illuminate\Support\Facades\Route::prefix('v1/pharmaco/expenses/items')
    ->middleware([
        'auth:sanctum',
        \App\Http\Middleware\EnsureTenantModuleActive::class . ':pharmaco.sales',
    ])
    ->group(function (): void {
        \Illuminate\Support\Facades\Route::get(
            '/',
            [\App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseItemController::class, 'index']
        )->middleware(
            \App\Http\Middleware\EnsureAnyPermission::class . ':finance.expenses.view,finance.expenses.create,finance.expenses.approve,finance.expenses.reverse'
        );

        \Illuminate\Support\Facades\Route::get(
            '/contribution',
            [\App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseItemController::class, 'contribution']
        )->middleware(
            \App\Http\Middleware\EnsureAnyPermission::class . ':finance.expenses.view,finance.expenses.create,finance.expenses.approve,finance.expenses.reverse'
        );

        \Illuminate\Support\Facades\Route::post(
            '/',
            [\App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseItemController::class, 'store']
        )->middleware(
            \App\Http\Middleware\EnsureAnyPermission::class . ':finance.expenses.create'
        );

        \Illuminate\Support\Facades\Route::patch(
            '/{itemUuid}',
            [\App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseItemController::class, 'update']
        )->middleware(
            \App\Http\Middleware\EnsureAnyPermission::class . ':finance.expenses.create'
        );

        \Illuminate\Support\Facades\Route::delete(
            '/{itemUuid}',
            [\App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseItemController::class, 'destroy']
        )->middleware(
            \App\Http\Middleware\EnsureAnyPermission::class . ':finance.expenses.create'
        );
    });



use App\Http\Controllers\Api\V1\PharmaCo360\FinanceExpenseController;
use Illuminate\Support\Facades\Route;

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
])
    ->prefix('v1/pharmaco/expenses')
    ->group(function (): void {
        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:'
            . 'finance.expenses.view,'
            . 'finance.expenses.create,'
            . 'finance.expenses.approve,'
            . 'finance.expenses.reverse'
        )->group(function (): void {
            Route::get(
                '/',
                [
                    FinanceExpenseController::class,
                    'index',
                ]
            );

            Route::get(
                '/reference-data',
                [
                    FinanceExpenseController::class,
                    'referenceData',
                ]
            );

            Route::get(
                '/approval-queue',
                [
                    FinanceExpenseController::class,
                    'approvalQueue',
                ]
            );

            Route::get(
                '/{expenseUuid}',
                [
                    FinanceExpenseController::class,
                    'show',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:'
            . 'finance.expenses.create'
        )->group(function (): void {
            Route::post(
                '/',
                [
                    FinanceExpenseController::class,
                    'store',
                ]
            );

            Route::put(
                '/{expenseUuid}',
                [
                    FinanceExpenseController::class,
                    'update',
                ]
            );

            Route::post(
                '/{expenseUuid}/submit',
                [
                    FinanceExpenseController::class,
                    'submit',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:'
            . 'finance.expenses.approve'
        )->group(function (): void {
            Route::post(
                '/{expenseUuid}/approve',
                [
                    FinanceExpenseController::class,
                    'approve',
                ]
            );

            Route::post(
                '/{expenseUuid}/reject',
                [
                    FinanceExpenseController::class,
                    'reject',
                ]
            );

            Route::post(
                '/{expenseUuid}/post',
                [
                    FinanceExpenseController::class,
                    'post',
                ]
            );
        });

        Route::middleware(
            'App\\Http\\Middleware\\EnsureAnyPermission:'
            . 'finance.expenses.reverse'
        )->group(function (): void {
            Route::post(
                '/{expenseUuid}/reverse',
                [
                    FinanceExpenseController::class,
                    'reverse',
                ]
            );
        });
    });
