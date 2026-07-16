<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/v1/security/users/{user}/admin-reset-password', function (Request $request, User $user) {
        $actor = $request->user();

        if (! $actor || ! method_exists($actor, 'hasAnyPermission') || ! $actor->hasAnyPermission([
            'roles.manage',
            'tenant.roles.manage',
            'security.users.manage',
            'security.roles.edit',
        ])) {
            return response()->json([
                'message' => 'You do not have permission to reset another user password.',
            ], 403);
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'must_change_password' => ['sometimes', 'boolean'],
        ]);

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => (bool) ($validated['must_change_password'] ?? true),
            'status' => 'active',
            'updated_at' => now(),
        ])->save();

        DB::table('tenant_users')
            ->where('user_id', $user->id)
            ->update(['status' => 'active', 'updated_at' => now()]);

        DB::table('role_user')
            ->where('user_id', $user->id)
            ->update(['status' => 'active', 'updated_at' => now()]);

        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'like', '%User')
            ->where('tokenable_id', $user->id)
            ->delete();

        if (Schema::hasTable('sessions')) {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return response()->json([
            'message' => 'Password reset successfully. The user must sign in again.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'must_change_password' => (bool) $user->must_change_password,
            ],
        ]);
    });

    Route::get('/v1/pharmaco/business-analytics/live', function (Request $request) {
        $actor = $request->user();

        if (! $actor || ! method_exists($actor, 'hasAnyPermission') || ! $actor->hasAnyPermission([
            'pharmaco.sales.view',
            'pharmaco.sales.manage',
            'pharmaco.reports.view',
            'reports.sales.view',
        ])) {
            return response()->json([
                'message' => 'You do not have permission to view business analytics.',
            ], 403);
        }

        $businessDate = $request->query('business_date') ?: $request->query('date') ?: now()->toDateString();

        $salesQuery = DB::table('pharmaco_sales')
            ->whereDate('business_date', $businessDate);

        $paymentsQuery = DB::table('pharmaco_payments')
            ->whereDate('business_date', $businessDate);

        $salesTotal = (float) (clone $salesQuery)->sum('total_amount');
        $collectionsTotal = (float) (clone $paymentsQuery)->sum('amount');
        $transactionCount = (int) (clone $salesQuery)->count();
        $receiptCount = (int) (clone $paymentsQuery)->whereNotNull('receipt_number')->count();

        $openBalance = 0.0;

        if (Schema::hasTable('pharmaco_customer_receivables')) {
            $openBalance = (float) DB::table('pharmaco_customer_receivables')
                ->whereIn('status', ['open', 'partially_paid', 'pending'])
                ->sum('balance_amount');
        }

        $paymentMethods = (clone $paymentsQuery)
            ->select(
                'payment_method',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(amount) as amount')
            )
            ->groupBy('payment_method')
            ->orderByDesc('amount')
            ->get();

        return response()->json([
            'message' => 'Live business analytics calculated from current operational records.',
            'business_date' => $businessDate,
            'sales_total' => $salesTotal,
            'collections_total' => $collectionsTotal,
            'open_balance' => $openBalance,
            'transaction_count' => $transactionCount,
            'receipt_count' => $receiptCount,
            'average_transaction_value' => $transactionCount > 0 ? round($salesTotal / $transactionCount, 2) : 0,
            'collection_ratio' => $salesTotal > 0 ? round(($collectionsTotal / $salesTotal) * 100, 2) : 0,
            'payment_methods' => $paymentMethods,
            'signals' => [
                [
                    'label' => 'Business performance',
                    'value' => $salesTotal,
                    'detail' => 'Practical signals derived from current sales, collections, balances, and transaction patterns.',
                ],
                [
                    'label' => 'Collections',
                    'value' => $collectionsTotal,
                    'detail' => $collectionsTotal >= $salesTotal
                        ? 'Collections are covering current paid sales.'
                        : 'Collections are below current sales value.',
                ],
                [
                    'label' => 'Open balance',
                    'value' => $openBalance,
                    'detail' => $openBalance > 0
                        ? 'Open balances require follow-up.'
                        : 'No open balance pressure detected.',
                ],
            ],
        ]);
    });

    Route::get('/v1/pharmaco/pos/recent-transactions-with-users', function (Request $request) {
        $actor = $request->user();

        if (! $actor || ! method_exists($actor, 'hasAnyPermission') || ! $actor->hasAnyPermission([
            'pharmaco.pos.use',
            'pharmaco.sales.view',
            'pharmaco.sales.manage',
        ])) {
            return response()->json([
                'message' => 'You do not have permission to view recent POS transactions.',
            ], 403);
        }

        $rows = DB::table('pharmaco_sales as s')
            ->leftJoin('pharmaco_payments as p', 'p.sale_id', '=', 's.id')
            ->leftJoin('users as su', 'su.id', '=', 's.created_by')
            ->leftJoin('users as pu', 'pu.id', '=', 'p.received_by')
            ->select([
                's.id',
                's.sale_number',
                's.business_date',
                's.sold_at',
                's.created_at',
                's.created_by',
                's.total_amount',
                's.payment_status',
                'p.payment_method',
                'p.receipt_number',
                'p.amount as paid_amount',
                'p.received_at',
                'p.received_by',
                DB::raw('COALESCE(su.name, pu.name) as operator_name'),
                DB::raw('COALESCE(su.email, pu.email) as operator_email'),
            ])
            ->orderByDesc(DB::raw('COALESCE(p.received_at, s.sold_at, s.created_at)'))
            ->limit(50)
            ->get();

        return response()->json([
            'message' => 'Recent POS transactions with creator and cashier details.',
            'transactions' => $rows,
        ]);
    });
});
