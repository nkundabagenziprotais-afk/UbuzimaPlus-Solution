<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FinanceExpenseItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $status = (string) $request->query('status', '');
        $search = trim((string) $request->query('search', ''));

        $query = DB::table('finance_expense_items as i')
            ->join('finance_chart_of_accounts as a', 'a.id', '=', 'i.finance_chart_of_account_id')
            ->where('i.tenant_id', $tenantId);

        if ($status !== '') {
            $query->where('i.status', $status);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('i.name', 'like', '%' . $search . '%')
                    ->orWhere('i.code', 'like', '%' . $search . '%')
                    ->orWhere('i.group_name', 'like', '%' . $search . '%');
            });
        }

        $items = $query
            ->orderBy('i.group_name')
            ->orderBy('i.name')
            ->get([
                'i.id',
                'i.uuid',
                'i.code',
                'i.name',
                'i.group_name',
                'i.description',
                'i.status',
                'i.is_system_seed',
                'i.finance_chart_of_account_id',
                'a.code as account_code',
                'a.name as account_name',
            ]);

        $usage = DB::table('finance_expense_lines')
            ->whereNotNull('finance_expense_item_id')
            ->select('finance_expense_item_id', DB::raw('COUNT(*) as count_used'))
            ->groupBy('finance_expense_item_id')
            ->pluck('count_used', 'finance_expense_item_id');

        return response()->json([
            'items' => $items->map(function ($item) use ($usage): array {
                return [
                    'id' => (int) $item->id,
                    'uuid' => (string) $item->uuid,
                    'code' => (string) $item->code,
                    'name' => (string) $item->name,
                    'group_name' => $item->group_name,
                    'description' => $item->description,
                    'status' => (string) $item->status,
                    'is_system_seed' => (bool) $item->is_system_seed,
                    'finance_chart_of_account_id' => (int) $item->finance_chart_of_account_id,
                    'account_code' => (string) $item->account_code,
                    'account_name' => (string) $item->account_name,
                    'used_count' => (int) ($usage[$item->id] ?? 0),
                ];
            })->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);
        $payload = $this->validatedPayload($request, $tenantId);

        $timestamp = now()->toDateTimeString();

        $exists = DB::table('finance_expense_items')
            ->where('tenant_id', $tenantId)
            ->where(function ($builder) use ($payload): void {
                $builder
                    ->where('code', $payload['code'])
                    ->orWhere('name', $payload['name']);
            })
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'name' => ['An expense item with this code or name already exists.'],
            ]);
        }

        DB::table('finance_expense_items')->insert([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'finance_chart_of_account_id' => $payload['finance_chart_of_account_id'],
            'code' => $payload['code'],
            'name' => $payload['name'],
            'group_name' => $payload['group_name'] ?? null,
            'description' => $payload['description'] ?? null,
            'status' => $payload['status'],
            'is_system_seed' => false,
            'metadata' => json_encode([
                'release' => 'expense_items_simple_form_r1',
                'created_via' => 'expense_items_workspace',
            ], JSON_UNESCAPED_SLASHES),
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return response()->json([
            'message' => 'Expense item created.',
        ], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $item = DB::table('finance_expense_items')
            ->where('tenant_id', $tenantId)
            ->where('uuid', $uuid)
            ->first();

        if (! $item) {
            abort(404, 'Expense item not found.');
        }

        $payload = $this->validatedPayload($request, $tenantId);

        $duplicate = DB::table('finance_expense_items')
            ->where('tenant_id', $tenantId)
            ->where('id', '<>', $item->id)
            ->where(function ($builder) use ($payload): void {
                $builder
                    ->where('code', $payload['code'])
                    ->orWhere('name', $payload['name']);
            })
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'name' => ['Another expense item already uses this code or name.'],
            ]);
        }

        DB::table('finance_expense_items')
            ->where('id', $item->id)
            ->update([
                'finance_chart_of_account_id' => $payload['finance_chart_of_account_id'],
                'code' => $payload['code'],
                'name' => $payload['name'],
                'group_name' => $payload['group_name'] ?? null,
                'description' => $payload['description'] ?? null,
                'status' => $payload['status'],
                'updated_by' => $request->user()?->id,
                'updated_at' => now()->toDateTimeString(),
            ]);

        return response()->json([
            'message' => 'Expense item updated.',
        ]);
    }

    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $item = DB::table('finance_expense_items')
            ->where('tenant_id', $tenantId)
            ->where('uuid', $uuid)
            ->first();

        if (! $item) {
            abort(404, 'Expense item not found.');
        }

        $used = DB::table('finance_expense_lines')
            ->where('finance_expense_item_id', $item->id)
            ->exists();

        if ($used) {
            DB::table('finance_expense_items')
                ->where('id', $item->id)
                ->update([
                    'status' => 'inactive',
                    'updated_by' => $request->user()?->id,
                    'updated_at' => now()->toDateTimeString(),
                ]);

            return response()->json([
                'message' => 'Expense item is already used, so it was deactivated instead of deleted.',
                'deactivated' => true,
            ]);
        }

        DB::table('finance_expense_items')
            ->where('id', $item->id)
            ->delete();

        return response()->json([
            'message' => 'Expense item deleted.',
            'deleted' => true,
        ]);
    }

    public function contribution(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $query = DB::table('finance_expense_lines as l')
            ->join('finance_expenses as e', 'e.id', '=', 'l.finance_expense_id')
            ->leftJoin('finance_expense_items as i', 'i.id', '=', 'l.finance_expense_item_id')
            ->leftJoin('finance_chart_of_accounts as a', 'a.id', '=', 'l.finance_chart_of_account_id')
            ->where('e.tenant_id', $tenantId)
            ->whereNotIn('e.status', ['rejected', 'reversed']);

        if ($request->filled('from')) {
            $query->whereDate('e.business_date', '>=', (string) $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('e.business_date', '<=', (string) $request->query('to'));
        }

        $rows = $query
            ->groupBy('l.finance_expense_item_id', 'i.name', 'i.code', 'a.code', 'a.name', 'l.description')
            ->orderByDesc(DB::raw('SUM(l.amount)'))
            ->get([
                'l.finance_expense_item_id',
                'i.name as item_name',
                'i.code as item_code',
                'a.code as account_code',
                'a.name as account_name',
                'l.description as fallback_description',
                DB::raw('SUM(l.amount) as amount'),
            ]);

        $total = (float) $rows->sum('amount');

        return response()->json([
            'total_amount' => round($total, 4),
            'items' => $rows->map(function ($row) use ($total): array {
                $amount = (float) $row->amount;

                return [
                    'expense_item_id' => $row->finance_expense_item_id ? (int) $row->finance_expense_item_id : null,
                    'item_code' => $row->item_code,
                    'item_name' => $row->item_name ?: ($row->fallback_description ?: 'Unclassified Expense'),
                    'account_code' => $row->account_code,
                    'account_name' => $row->account_name,
                    'amount' => round($amount, 4),
                    'contribution_percent' => $total > 0 ? round(($amount / $total) * 100, 2) : 0,
                ];
            })->values(),
        ]);
    }

    private function validatedPayload(Request $request, int $tenantId): array
    {
        $validated = $request->validate([
            'finance_chart_of_account_id' => ['required', 'integer'],
            'code' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:191'],
            'group_name' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $account = DB::table('finance_chart_of_accounts')
            ->where('tenant_id', $tenantId)
            ->where('id', (int) $validated['finance_chart_of_account_id'])
            ->where('account_type', 'expense')
            ->where('is_active', 1)
            ->first();

        if (! $account) {
            throw ValidationException::withMessages([
                'finance_chart_of_account_id' => ['Select an active expense account.'],
            ]);
        }

        $validated['name'] = trim($validated['name']);
        $validated['code'] = $this->normalizeCode($validated['code'] ?? $validated['name']);
        $validated['status'] = $validated['status'] ?? 'active';

        return $validated;
    }

    private function normalizeCode(string $value): string
    {
        $code = strtoupper((string) Str::of($value)->ascii()->replaceMatches('/[^A-Za-z0-9]+/', '_')->trim('_'));

        return substr($code ?: 'EXPENSE_ITEM', 0, 100);
    }

    private function tenantId(Request $request): int
    {
        $tenant = $request->attributes->get('tenant');

        $id =
            $request->attributes->get('tenant_id')
            ?? $request->attributes->get('tenantId')
            ?? (is_object($tenant) ? ($tenant->id ?? null) : null)
            ?? $request->user()?->tenant_id
            ?? $request->user()?->current_tenant_id;

        $id = (int) $id;

        if ($id <= 0) {
            throw ValidationException::withMessages([
                'tenant' => ['Tenant context is required.'],
            ]);
        }

        return $id;
    }
}
