<?php

use App\Http\Controllers\Api\V1\PharmaCo360\FinancePlanningPerformanceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Finance Planning & Performance
|--------------------------------------------------------------------------
|
| Planning / management only.
|
| Recurring rules do not directly post:
| - payments
| - cash movements
| - expense postings
| - journal entries
|
*/

Route::middleware([
    'auth:sanctum',
    'tenant.module:pharmaco.sales',
    'App\Http\Middleware\EnsureAnyPermission:finance.dashboard.view,finance.reports.view,reports.finance.view',
])
    ->prefix(
        'v1/pharmaco/finance/planning'
    )
    ->group(function (): void {
        Route::get(
            '/overview',
            [
                FinancePlanningPerformanceController::class,
                'overview',
            ]
        );

        Route::get(
            '/budgets',
            [
                FinancePlanningPerformanceController::class,
                'budgets',
            ]
        );

        Route::get(
            '/kpis',
            [
                FinancePlanningPerformanceController::class,
                'kpis',
            ]
        );

        Route::get(
            '/recurring',
            [
                FinancePlanningPerformanceController::class,
                'recurring',
            ]
        );

        Route::get(
            '/recurring/due',
            [
                FinancePlanningPerformanceController::class,
                'recurringDue',
            ]
        );

        Route::get(
            '/forecast',
            [
                FinancePlanningPerformanceController::class,
                'forecast',
            ]
        );

        Route::middleware(
            'permission:finance.settings.manage'
        )->group(function (): void {
            Route::post(
                '/budgets',
                [
                    FinancePlanningPerformanceController::class,
                    'storeBudget',
                ]
            );

            Route::put(
                '/budgets/{uuid}',
                [
                    FinancePlanningPerformanceController::class,
                    'updateBudget',
                ]
            );

            Route::post(
                '/kpis',
                [
                    FinancePlanningPerformanceController::class,
                    'storeKpi',
                ]
            );

            Route::put(
                '/kpis/{uuid}',
                [
                    FinancePlanningPerformanceController::class,
                    'updateKpi',
                ]
            );

            Route::post(
                '/recurring',
                [
                    FinancePlanningPerformanceController::class,
                    'storeRecurring',
                ]
            );

            Route::put(
                '/recurring/{uuid}',
                [
                    FinancePlanningPerformanceController::class,
                    'updateRecurring',
                ]
            );

            Route::post(
                '/recurring/{uuid}/pause',
                [
                    FinancePlanningPerformanceController::class,
                    'pauseRecurring',
                ]
            );

            Route::post(
                '/recurring/{uuid}/resume',
                [
                    FinancePlanningPerformanceController::class,
                    'resumeRecurring',
                ]
            );
        });
    });
