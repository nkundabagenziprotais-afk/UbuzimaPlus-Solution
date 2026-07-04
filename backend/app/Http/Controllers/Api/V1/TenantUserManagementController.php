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

class TenantUserManagementController extends Controller
{
    private function roleTemplates(): array
    {
        return [
            'owner' => [
                'name' => 'Owner',
                'description' => 'Full tenant control, users, approvals, reports, POS, inventory, procurement and AI.',
                'permissions' => [
                    'roles.manage',
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.suppliers.manage',
                    'pharmaco.reports.view',
                    'pharmaco.chat.manage',
                    'notifications.manage',
                    'ai.use',
                ],
            ],
            'manager' => [
                'name' => 'Manager',
                'description' => 'Daily operations, sales, inventory, procurement, reports and approvals.',
                'permissions' => [
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.suppliers.manage',
                    'pharmaco.reports.view',
                    'notifications.manage',
                    'ai.use',
                ],
            ],
            'pharmacist' => [
                'name' => 'Pharmacist',
                'description' => 'Dispensing, product safety, stock review, expiry and patient-facing pharmacy operations.',
                'permissions' => [
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.chat.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'cashier' => [
                'name' => 'Cashier',
                'description' => 'Counter sales, receipts, checkout and limited sales visibility.',
                'permissions' => [
                    'pharmaco.pos.use',
                    'pharmaco.sales.manage',
                ],
            ],
            'procurement-officer' => [
                'name' => 'Procurement Officer',
                'description' => 'Suppliers, purchase orders, receiving and procurement follow-up.',
                'permissions' => [
                    'pharmaco.suppliers.manage',
                    'pharmaco.inventory.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'inventory-officer' => [
                'name' => 'Inventory Officer',
                'description' => 'Product Master, stock batches, expiry, receiving, stock counts and low-stock controls.',
                'permissions' => [
                    'pharmaco.inventory.manage',
                    'pharmaco.reports.view',
                    'ai.use',
                ],
            ],
            'finance-officer' => [
                'name' => 'Finance Officer',
                'description' => 'Sales visibility, receivables, payables, procurement invoices and reports.',
                'permissions' => [
                    'pharmaco.sales.manage',
                    'pharmaco.suppliers.manage',
                    'pharmaco.reports.view',
                ],
            ],
            'hr-officer' => [
                'name' => 'HR Officer',
                'description' => 'Staff records, user readiness, role visibility and HR administration support.',
                'permissions' => [
                    'pharmaco.reports.view',
                    'notifications.manage',
                ],
            ],
            'delivery-officer' => [
                'name' => 'Delivery Officer',
                'description' => 'Delivery orders, dispatch status and customer delivery follow-up.',
                'permissions' => [
                    'pharmaco.sales.manage',
                    'notifications.manage',
                ],
            ],
            'auditor' => [
                'name' => 'Auditor',
                'description' => 'Read-focused review of reports, stock, sales and operating evidence.',
                'permissions' => [
                    'pharmaco.reports.view',
                ],
            ],
            'support-assistant' => [
                'name' => 'Support/Admin Assistant',
                'description' => 'Limited operational support across notifications, reports and front-office assistance.',
                'permissions' => [
                    'pharmaco.reports.view',
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
            $user = User::query()->firstOrNew(['email' => strtolower($validated['email'])]);
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
