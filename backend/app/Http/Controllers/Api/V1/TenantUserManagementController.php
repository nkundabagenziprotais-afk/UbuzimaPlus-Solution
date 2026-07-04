<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantUserManagementController extends Controller
{
    private function roleTemplates(): array
    {
        $allPermissions = [
            'tenant.dashboard.view',
            'tenant.settings.view',
            'tenant.settings.manage',
            'branches.view',
            'branches.manage',

            'roles.manage',
            'users.view',
            'users.create',
            'users.update',
            'users.deactivate',
            'users.permissions.edit',
            'security.access.view',
            'security.audit.view',

            'pharmaco.pos.use',
            'pharmaco.pos.open_session',
            'pharmaco.pos.close_session',
            'pharmaco.pos.discount',
            'pharmaco.pos.refund',
            'pharmaco.pos.void_sale',
            'pharmaco.pos.cash_drawer',
            'pharmaco.pos.daily_close',

            'pharmaco.sales.manage',
            'pharmaco.sales.view',
            'pharmaco.sales.create',
            'pharmaco.sales.return',
            'pharmaco.sales.credit_sale',
            'pharmaco.sales.receipt.reprint',
            'pharmaco.customers.view',
            'pharmaco.customers.manage',

            'pharmaco.prescriptions.view',
            'pharmaco.prescriptions.manage',
            'pharmaco.dispensing.review',
            'pharmaco.clinical.alerts.view',

            'pharmaco.inventory.manage',
            'pharmaco.inventory.view',
            'pharmaco.product_master.view',
            'pharmaco.product_master.manage',
            'pharmaco.product_inventory.receive',
            'pharmaco.product_inventory.update',
            'pharmaco.product_inventory.delete',
            'pharmaco.inventory.adjust',
            'pharmaco.inventory.transfer',
            'pharmaco.inventory.stock_count',
            'pharmaco.inventory.low_stock.view',
            'pharmaco.inventory.batch_expiry.view',
            'pharmaco.inventory.batch_expiry.manage',
            'pharmaco.inventory.valuation.view',

            'pharmaco.suppliers.manage',
            'pharmaco.procurement.view',
            'pharmaco.procurement.suppliers.manage',
            'pharmaco.procurement.purchase_order.create',
            'pharmaco.procurement.purchase_order.approve',
            'pharmaco.procurement.purchase_order.receive',
            'pharmaco.procurement.invoice.manage',
            'pharmaco.procurement.payment.view',
            'pharmaco.procurement.supplier_performance.view',

            'pharmaco.finance.view',
            'pharmaco.finance.cash.view',
            'pharmaco.finance.receivables.manage',
            'pharmaco.finance.payables.manage',
            'pharmaco.finance.reconciliation.manage',
            'pharmaco.finance.export',

            'pharmaco.reports.view',
            'pharmaco.reports.export',
            'pharmaco.reports.sales',
            'pharmaco.reports.inventory',
            'pharmaco.reports.procurement',
            'pharmaco.reports.finance',
            'pharmaco.reports.audit',

            'pharmaco.hr.view',
            'pharmaco.hr.manage',
            'pharmaco.staff_schedule.view',
            'pharmaco.staff_schedule.manage',

            'pharmaco.delivery.view',
            'pharmaco.delivery.assign',
            'pharmaco.delivery.dispatch',
            'pharmaco.delivery.complete',

            'pharmaco.chat.manage',
            'notifications.view',
            'notifications.manage',

            'ai.use',
            'ai.inventory.assistant',
            'ai.sales.assistant',
            'ai.procurement.assistant',
            'ai.recommendations.approve',
            'ai.audit.view',

            'audit.logs.view',
        ];

        $managerPermissions = array_values(array_diff($allPermissions, [
            'tenant.settings.manage',
            'roles.manage',
            'users.permissions.edit',
            'security.audit.view',
            'pharmaco.finance.export',
            'pharmaco.reports.audit',
            'audit.logs.view',
        ]));

        return [
            'owner' => [
                'name' => 'Owner',
                'description' => 'Full Vita Pharma control across users, permissions, POS, inventory, procurement, finance, reports, AI, audit and settings.',
                'permissions' => $allPermissions,
            ],
            'manager' => [
                'name' => 'Manager',
                'description' => 'Daily operational control for branches, sales, inventory, procurement, reports, notifications and AI recommendations.',
                'permissions' => $managerPermissions,
            ],
            'pharmacist' => [
                'name' => 'Pharmacist',
                'description' => 'Dispensing, prescription review, clinical alerts, product safety, inventory visibility and patient-facing pharmacy operations.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.pos.use',
                    'pharmaco.sales.view',
                    'pharmaco.sales.create',
                    'pharmaco.customers.view',
                    'pharmaco.prescriptions.view',
                    'pharmaco.prescriptions.manage',
                    'pharmaco.dispensing.review',
                    'pharmaco.clinical.alerts.view',
                    'pharmaco.inventory.view',
                    'pharmaco.product_master.view',
                    'pharmaco.inventory.low_stock.view',
                    'pharmaco.inventory.batch_expiry.view',
                    'pharmaco.reports.view',
                    'pharmaco.reports.sales',
                    'pharmaco.reports.inventory',
                    'pharmaco.chat.manage',
                    'notifications.view',
                    'ai.use',
                    'ai.inventory.assistant',
                    'ai.sales.assistant',
                ],
            ],
            'cashier' => [
                'name' => 'Cashier',
                'description' => 'Counter sales, receipts, customer lookup, POS session work and limited sales visibility.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.pos.use',
                    'pharmaco.pos.open_session',
                    'pharmaco.pos.close_session',
                    'pharmaco.sales.view',
                    'pharmaco.sales.create',
                    'pharmaco.customers.view',
                    'notifications.view',
                ],
            ],
            'procurement-officer' => [
                'name' => 'Procurement Officer',
                'description' => 'Supplier records, purchase orders, receiving, procurement invoices and supplier performance follow-up.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.inventory.view',
                    'pharmaco.product_master.view',
                    'pharmaco.product_inventory.receive',
                    'pharmaco.suppliers.manage',
                    'pharmaco.procurement.view',
                    'pharmaco.procurement.suppliers.manage',
                    'pharmaco.procurement.purchase_order.create',
                    'pharmaco.procurement.purchase_order.receive',
                    'pharmaco.procurement.invoice.manage',
                    'pharmaco.procurement.payment.view',
                    'pharmaco.procurement.supplier_performance.view',
                    'pharmaco.reports.view',
                    'pharmaco.reports.procurement',
                    'notifications.view',
                    'ai.use',
                    'ai.procurement.assistant',
                ],
            ],
            'inventory-officer' => [
                'name' => 'Inventory Officer',
                'description' => 'Product Master, product inventory, batch/expiry, stock counts, low-stock monitoring and inventory adjustments.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.inventory.manage',
                    'pharmaco.inventory.view',
                    'pharmaco.product_master.view',
                    'pharmaco.product_master.manage',
                    'pharmaco.product_inventory.receive',
                    'pharmaco.product_inventory.update',
                    'pharmaco.inventory.adjust',
                    'pharmaco.inventory.transfer',
                    'pharmaco.inventory.stock_count',
                    'pharmaco.inventory.low_stock.view',
                    'pharmaco.inventory.batch_expiry.view',
                    'pharmaco.inventory.batch_expiry.manage',
                    'pharmaco.inventory.valuation.view',
                    'pharmaco.reports.view',
                    'pharmaco.reports.inventory',
                    'notifications.view',
                    'ai.use',
                    'ai.inventory.assistant',
                ],
            ],
            'finance-officer' => [
                'name' => 'Finance Officer',
                'description' => 'Sales visibility, receivables, payables, supplier invoices, reconciliation, finance reports and exports.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.sales.view',
                    'pharmaco.procurement.view',
                    'pharmaco.procurement.invoice.manage',
                    'pharmaco.procurement.payment.view',
                    'pharmaco.finance.view',
                    'pharmaco.finance.cash.view',
                    'pharmaco.finance.receivables.manage',
                    'pharmaco.finance.payables.manage',
                    'pharmaco.finance.reconciliation.manage',
                    'pharmaco.finance.export',
                    'pharmaco.reports.view',
                    'pharmaco.reports.sales',
                    'pharmaco.reports.procurement',
                    'pharmaco.reports.finance',
                    'notifications.view',
                ],
            ],
            'hr-officer' => [
                'name' => 'HR Officer',
                'description' => 'Staff visibility, HR records, staff schedule and user readiness without full system security control.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'users.view',
                    'pharmaco.hr.view',
                    'pharmaco.hr.manage',
                    'pharmaco.staff_schedule.view',
                    'pharmaco.staff_schedule.manage',
                    'pharmaco.reports.view',
                    'notifications.view',
                    'notifications.manage',
                ],
            ],
            'delivery-officer' => [
                'name' => 'Delivery Officer',
                'description' => 'Delivery list, dispatch, completion status, customer delivery follow-up and notifications.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.sales.view',
                    'pharmaco.customers.view',
                    'pharmaco.delivery.view',
                    'pharmaco.delivery.dispatch',
                    'pharmaco.delivery.complete',
                    'notifications.view',
                ],
            ],
            'auditor' => [
                'name' => 'Auditor',
                'description' => 'Read-focused access to reports, stock, sales, procurement, finance evidence, audit logs and AI audit evidence.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'security.access.view',
                    'security.audit.view',
                    'pharmaco.sales.view',
                    'pharmaco.inventory.view',
                    'pharmaco.procurement.view',
                    'pharmaco.finance.view',
                    'pharmaco.reports.view',
                    'pharmaco.reports.sales',
                    'pharmaco.reports.inventory',
                    'pharmaco.reports.procurement',
                    'pharmaco.reports.finance',
                    'pharmaco.reports.audit',
                    'ai.audit.view',
                    'audit.logs.view',
                ],
            ],
            'support-assistant' => [
                'name' => 'Support/Admin Assistant',
                'description' => 'Limited front-office and operational support with reports, notifications and non-sensitive assistance.',
                'permissions' => [
                    'tenant.dashboard.view',
                    'pharmaco.sales.view',
                    'pharmaco.inventory.view',
                    'pharmaco.product_master.view',
                    'pharmaco.reports.view',
                    'notifications.view',
                    'notifications.manage',
                ],
            ],
        ];
    }

    public function roleTemplatesResponse(): JsonResponse
    {
        return response()->json([
            'roles' => collect($this->roleTemplates())->map(fn ($template, $code) => [
                'code' => $code,
                ...$template,
            ])->values(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $assignments = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->with(['user.roles.permissions', 'branch'])
            ->latest()
            ->get()
            ->map(fn (TenantUser $assignment) => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->name,
                'email' => $assignment->user->email,
                'phone' => $assignment->user->phone,
                'job_title' => $assignment->job_title,
                'status' => $assignment->status,
                'branch' => $assignment->branch ? [
                    'id' => $assignment->branch->id,
                    'name' => $assignment->branch->name,
                ] : null,
                'roles' => $assignment->user->roles
                    ->filter(fn (Role $role) => (int) ($role->pivot->tenant_id ?? 0) === (int) $tenant->id)
                    ->map(fn (Role $role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                        'code' => $role->code,
                        'permissions' => $role->permissions->pluck('code')->values(),
                    ])
                    ->values(),
            ]);

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'users' => $assignments,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'email' => ['required', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:191'],
            'role_code' => ['required', 'string', 'max:80'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:100'],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'branch_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        $temporaryPassword = $validated['password'] ?? (Str::random(10) . '1!');

        $user = DB::transaction(function () use ($tenant, $validated, $temporaryPassword, $request) {
            $email = strtolower($validated['email']);
            $user = User::query()->where('email', $email)->first() ?? new User();
            $user->email = $email;
            $user->name = $validated['name'];
            $user->phone = $validated['phone'] ?? $user->phone;
            $user->password = Hash::make($temporaryPassword);
            $user->forceFill([
                'must_change_password' => true,
                'two_factor_required' => false,
            ]);
            $user->save();

            TenantUser::query()->updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'user_id' => $user->id,
                ],
                [
                    'branch_id' => $validated['branch_id'] ?? null,
                    'job_title' => $validated['job_title'] ?? null,
                    'status' => $validated['status'] ?? 'active',
                    'invited_by' => $request->user()?->id,
                    'joined_at' => now(),
                ],
            );

            $role = $this->ensureTenantRole(
                $tenant,
                $validated['role_code'],
                $validated['permissions'] ?? null,
            );

            $user->roles()->syncWithoutDetaching([
                $role->id => [
                    'tenant_id' => $tenant->id,
                    'solution_id' => null,
                    'branch_id' => $validated['branch_id'] ?? null,
                    'status' => 'active',
                ],
            ]);

            return $user->fresh(['roles.permissions', 'tenantAssignments']);
        });

        return response()->json([
            'message' => 'User created for Vita Pharma.',
            'temporary_password' => $temporaryPassword,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:191'],
            'role_code' => ['required', 'string', 'max:80'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:100'],
            'branch_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);

        DB::transaction(function () use ($tenant, $validated, $user) {
            $user->fill([
                'name' => $validated['name'] ?? $user->name,
                'phone' => $validated['phone'] ?? $user->phone,
            ]);
            $user->save();

            TenantUser::query()->updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'user_id' => $user->id,
                ],
                [
                    'branch_id' => $validated['branch_id'] ?? null,
                    'job_title' => $validated['job_title'] ?? null,
                    'status' => $validated['status'] ?? 'active',
                ],
            );

            $role = $this->ensureTenantRole(
                $tenant,
                $validated['role_code'],
                $validated['permissions'] ?? null,
            );

            $user->roles()
                ->wherePivot('tenant_id', $tenant->id)
                ->detach();

            $user->roles()->attach($role->id, [
                'tenant_id' => $tenant->id,
                'solution_id' => null,
                'branch_id' => $validated['branch_id'] ?? null,
                'status' => 'active',
            ]);
        });

        return response()->json([
            'message' => 'User access updated.',
        ]);
    }


    public function destroy(Request $request, User $user): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        if ((int) $request->user()?->id === (int) $user->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot deactivate your own active session account.'],
            ]);
        }

        $assignment = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $targetHasSecurityControl = $user->roles()
            ->wherePivot('tenant_id', $tenant->id)
            ->whereHas('permissions', fn ($query) => $query->where('code', 'roles.manage'))
            ->exists();

        if ($targetHasSecurityControl) {
            $activeSecurityUsers = TenantUser::query()
                ->where('tenant_id', $tenant->id)
                ->where('status', 'active')
                ->whereHas('user.roles', function ($query) use ($tenant) {
                    $query
                        ->wherePivot('tenant_id', $tenant->id)
                        ->whereHas('permissions', fn ($permissionQuery) => $permissionQuery->where('code', 'roles.manage'));
                })
                ->count();

            if ($activeSecurityUsers <= 1) {
                throw ValidationException::withMessages([
                    'user' => ['At least one active administrator with role-management rights must remain.'],
                ]);
            }
        }

        DB::transaction(function () use ($tenant, $assignment, $user) {
            $assignment->forceFill([
                'status' => 'suspended',
            ])->save();

            $roleIds = $user->roles()
                ->wherePivot('tenant_id', $tenant->id)
                ->get()
                ->pluck('id');

            foreach ($roleIds as $roleId) {
                $user->roles()->updateExistingPivot($roleId, [
                    'status' => 'inactive',
                ]);
            }
        });

        return response()->json([
            'message' => 'User deactivated successfully. Audit history and previous records were retained.',
        ]);
    }

    private function resolveTenant(Request $request): Tenant
    {
        $slug = $request->input('tenant_slug')
            ?? $request->header('X-Tenant')
            ?? $request->header('X-Tenant-Slug')
            ?? 'vitapharma';

        return Tenant::query()
            ->where('slug', $slug)
            ->orWhere('name', 'like', '%Vita%Pharma%')
            ->firstOrFail();
    }

    private function ensureTenantRole(Tenant $tenant, string $requestedCode, ?array $requestedPermissions): Role
    {
        $templates = $this->roleTemplates();
        $template = $templates[$requestedCode] ?? $templates['support-assistant'];

        $tenantRoleCode = Str::slug($tenant->slug . '-' . $requestedCode);
        $permissions = $requestedPermissions ?: $template['permissions'];

        $role = Role::query()->firstOrCreate(
            ['code' => $tenantRoleCode],
            [
                'name' => $tenant->name . ' ' . $template['name'],
                'scope_type' => 'tenant',
                'description' => $template['description'],
                'status' => 'active',
            ],
        );

        $permissionIds = collect($permissions)
            ->map(fn (string $code) => Permission::query()->firstOrCreate(
                ['code' => $code],
                [
                    'name' => Str::headline(str_replace('.', ' ', $code)),
                    'permission_group' => str_contains($code, 'pharmaco') ? 'pharmaco' : 'security',
                    'description' => 'Default tenant permission for ' . $code,
                    'status' => 'active',
                ],
            )->id)
            ->values()
            ->all();

        $role->permissions()->sync($permissionIds);

        return $role;
    }
}
