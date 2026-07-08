<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\PharmacoPayment;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosSessionController extends Controller
{
    public function current(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $session = $this->todaySession($request);

        return response()->json([
            'business_date' => now()->toDateString(),
            'can_open' => $session === null,
            'session' => $session ? $this->serializeSession($session) : null,
            'rules' => [
                'one_open_per_user_per_day' => true,
                'one_close_per_user_per_day' => true,
                'zero_balance_required_before_close' => true,
                'tenant' => $tenant->slug,
            ],
        ]);
    }

    public function open(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
            'opening_mode' => ['nullable', 'string', 'in:fresh_start,handover'],
            'starting_cash' => ['nullable', 'numeric', 'gte:0'],
            'opening_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $branch = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'active')
            ->find($validated['branch_id']);

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => ['Select an active branch belonging to the current tenant.'],
            ]);
        }

        $session = DB::transaction(function () use ($request, $tenant, $branch, $validated) {
            $existing = PharmacoPosSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $request->user()->id)
                ->whereDate('business_date', now()->toDateString())
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $message = $existing->status === 'open'
                    ? 'Your POS session is already open for today.'
                    : 'Your POS session was already closed today and cannot be reopened.';

                throw ValidationException::withMessages(['session' => [$message]]);
            }

            return PharmacoPosSession::query()->create([
                'uuid' => (string) Str::uuid(),
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'user_id' => $request->user()->id,
                'business_date' => now()->toDateString(),
                'status' => 'open',
                'opening_mode' => $validated['opening_mode'] ?? 'fresh_start',
                'starting_cash' => $validated['starting_cash'] ?? 0,
                'opened_at' => now(),
                'opening_note' => $validated['opening_note'] ?? null,
                'metadata' => [
                    'opened_ip' => $request->ip(),
                    'opened_user_agent' => Str::limit((string) $request->userAgent(), 500),
                    'control_version' => 'daily-till-v1',
                ],
            ]);
        });

        return response()->json([
            'message' => 'POS session opened. This is your only permitted opening for today.',
            'session' => $this->serializeSession($session->load(['branch', 'user'])),
        ], 201);
    }

    public function transactions(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $session = $this->todaySession($request);

        if (! $session) {
            return response()->json(['session' => null, 'transactions' => []]);
        }

        $end = $session->closed_at ?? now();
        $sales = PharmacoSale::query()
            ->with(['customer', 'prescription', 'payments', 'items.product'])
            ->where('tenant_id', $tenant->id)
            ->where('branch_id', $session->branch_id)
            ->where('sold_by', $request->user()->id)
            ->where(function (Builder $query) use ($session, $end): void {
                $query->whereBetween('sold_at', [$session->opened_at, $end])
                    ->orWhere(function (Builder $fallback) use ($session, $end): void {
                        $fallback->whereNull('sold_at')
                            ->whereBetween('created_at', [$session->opened_at, $end]);
                    });
            })
            ->orderByRaw('COALESCE(sold_at, created_at) DESC')
            ->limit(250)
            ->get();

        return response()->json([
            'session' => $this->serializeSession($session),
            'transactions' => $sales->map(function (PharmacoSale $sale): array {
                $primaryPayment = $sale->payments->sortByDesc('received_at')->first();

                return [
                    'id' => $sale->id,
                    'sale_number' => $sale->sale_number,
                    'receipt_number' => $primaryPayment?->receipt_number,
                    'date_time' => ($sale->sold_at ?? $sale->created_at)?->toIso8601String(),
                    'customer' => trim(($sale->customer?->first_name ?? 'Walk-in').' '.($sale->customer?->last_name ?? '')),
                    'prescription_number' => $sale->prescription?->prescription_number,
                    'payment_method' => $primaryPayment?->payment_method ?? $sale->sale_type,
                    'payment_status' => $sale->payment_status,
                    'status' => $sale->status,
                    'subtotal_amount' => (float) $sale->subtotal_amount,
                    'discount_amount' => (float) $sale->discount_amount,
                    'tax_amount' => (float) $sale->tax_amount,
                    'total_amount' => (float) $sale->total_amount,
                    'paid_amount' => (float) $sale->paid_amount,
                    'balance_amount' => (float) $sale->balance_amount,
                    'item_count' => $sale->items->count(),
                    'items' => $sale->items->map(fn ($item) => [
                        'name' => $item->product?->name ?? 'Product',
                        'quantity' => (float) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'line_total' => (float) $item->line_total,
                    ])->values(),
                ];
            })->values(),
        ]);
    }

    public function close(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $validated = $request->validate([
            'close_mode' => ['required', 'string', 'in:handover,final_close'],
            'till_zeroized' => ['required', 'accepted'],
            'closing_cash_balance' => ['required', 'numeric', 'in:0,0.0,0.00'],
            'counted_cash' => ['required', 'numeric', 'gte:0'],
            'deposit_reference' => ['nullable', 'string', 'max:255'],
            'closing_note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($validated['close_mode'] === 'final_close' && blank($validated['deposit_reference'] ?? null)) {
            throw ValidationException::withMessages([
                'deposit_reference' => ['Final close requires a deposit reference or proof identifier.'],
            ]);
        }

        $session = DB::transaction(function () use ($request, $tenant, $validated) {
            $session = PharmacoPosSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $request->user()->id)
                ->whereDate('business_date', now()->toDateString())
                ->lockForUpdate()
                ->first();

            if (! $session) {
                throw ValidationException::withMessages(['session' => ['No POS session was opened for you today.']]);
            }

            if ($session->status !== 'open' || $session->closed_at) {
                throw ValidationException::withMessages(['session' => ['Your POS session has already been closed today.']]);
            }

            $pendingSales = PharmacoSale::query()
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $session->branch_id)
                ->where('sold_by', $request->user()->id)
                ->where('sale_type', '!=', 'credit_sale')
                ->where(function (Builder $query) use ($session): void {
                    $query->whereBetween('sold_at', [$session->opened_at, now()])
                        ->orWhere(function (Builder $fallback) use ($session): void {
                            $fallback->whereNull('sold_at')
                                ->whereBetween('created_at', [$session->opened_at, now()]);
                        });
                })
                ->whereIn('payment_status', ['unpaid', 'partially_paid'])
                ->count();

            if ($pendingSales > 0) {
                throw ValidationException::withMessages([
                    'session' => ["Resolve {$pendingSales} unpaid or partially paid non-credit sale(s) before closing the till."],
                ]);
            }

            $cashCollected = (float) PharmacoPayment::query()
                ->where('tenant_id', $tenant->id)
                ->where('received_by', $request->user()->id)
                ->where('payment_method', 'cash')
                ->where('status', 'completed')
                ->whereBetween('received_at', [$session->opened_at, now()])
                ->sum('amount');

            $expectedCash = (float) $session->starting_cash + $cashCollected;
            $countedCash = (float) $validated['counted_cash'];
            $metadata = $session->metadata ?? [];
            $metadata['closed_ip'] = $request->ip();
            $metadata['cash_collected'] = $cashCollected;
            $metadata['closed_user_agent'] = Str::limit((string) $request->userAgent(), 500);

            $session->forceFill([
                'status' => 'closed',
                'close_mode' => $validated['close_mode'],
                'expected_cash' => $expectedCash,
                'counted_cash' => $countedCash,
                'closing_cash_balance' => 0,
                'cash_variance' => $countedCash - $expectedCash,
                'till_zeroized' => true,
                'closed_at' => now(),
                'deposit_reference' => $validated['deposit_reference'] ?? null,
                'closing_note' => $validated['closing_note'] ?? null,
                'metadata' => $metadata,
            ])->save();

            return $session;
        });

        return response()->json([
            'message' => 'POS session closed and locked for today. Till zeroization and reconciliation values were recorded.',
            'session' => $this->serializeSession($session->load(['branch', 'user'])),
        ]);
    }

    private function todaySession(Request $request): ?PharmacoPosSession
    {
        $tenant = $request->attributes->get('tenant');

        return PharmacoPosSession::query()
            ->with(['branch', 'user'])
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $request->user()->id)
            ->whereDate('business_date', now()->toDateString())
            ->first();
    }

    private function serializeSession(PharmacoPosSession $session): array
    {
        return [
            'id' => $session->id,
            'uuid' => $session->uuid,
            'business_date' => $session->business_date?->toDateString(),
            'status' => $session->status,
            'opening_mode' => $session->opening_mode,
            'close_mode' => $session->close_mode,
            'starting_cash' => (float) $session->starting_cash,
            'expected_cash' => $session->expected_cash === null ? null : (float) $session->expected_cash,
            'counted_cash' => $session->counted_cash === null ? null : (float) $session->counted_cash,
            'closing_cash_balance' => $session->closing_cash_balance === null ? null : (float) $session->closing_cash_balance,
            'cash_variance' => $session->cash_variance === null ? null : (float) $session->cash_variance,
            'till_zeroized' => (bool) $session->till_zeroized,
            'opened_at' => $session->opened_at?->toIso8601String(),
            'closed_at' => $session->closed_at?->toIso8601String(),
            'deposit_reference' => $session->deposit_reference,
            'branch' => $session->branch ? [
                'id' => $session->branch->id,
                'name' => $session->branch->name,
                'code' => $session->branch->code,
            ] : null,
            'user' => $session->user ? [
                'id' => $session->user->id,
                'name' => $session->user->name,
            ] : null,
        ];
    }
}
