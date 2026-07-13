<?php

namespace App\Http\Controllers\Api\V1;

use App\Support\OperationalPermissionContract;
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
            'pharmaco.procurement.invoice.approve',
            'pharmaco.procurement.payment.view',
            'pharmaco.procurement.payment.manage',
            'pharmaco.procurement.supplier_performance.view',

            'pharmaco.finance.view',
            'pharmaco.finance.cash.view',
            'pharmaco.finance.receivables.manage',
            'pharmaco.finance.payables.manage',
            'pharmaco.finance.reconciliation.manage',
            'pharmaco.finance.export',

            'pharmaco.insurance.manage',
            'insurance.dashboard.view',
            'insurance.configuration.view',
            'insurance.configuration.manage',
            'insurance.memberships.view',
            'insurance.memberships.manage',
            'insurance.eligibility.check',
            'insurance.claims.view',
            'insurance.claims.create',
            'insurance.claims.adjudicate',
            'insurance.claims.payments',
            'insurance.reconciliation.view',
            'insurance.reconciliation.manage',
            'insurance.audit.view',

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
                    'branches.view',
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
                    'pharmaco.procurement.invoice.approve',
                    'pharmaco.procurement.payment.view',
                    'pharmaco.procurement.payment.manage',
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
                'permissions' => OperationalPermissionContract::expand(
                    $template['permissions'],
                ),
            ])->values(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $assignments = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'user.roles.permissions',
                'user.trustedDevices',
                'branch',
            ])
            ->latest()
            ->get()
            ->map(fn (TenantUser $assignment) => [
                'id' => $assignment->user->id,
                'name' => $assignment->user->name,
                'email' => $assignment->user->email,
                'phone' => $assignment->user->phone,
                'job_title' => $assignment->job_title,
                'status' => $assignment->status,
                'security' => [
                    'two_factor_required' =>
                        (bool) $assignment->user
                            ->two_factor_required,
                    'two_factor_enabled' =>
                        (bool) $assignment->user
                            ->two_factor_enabled,
                    'must_change_password' =>
                        (bool) $assignment->user
                            ->must_change_password,
                    'last_login_at' =>
                        optional(
                            $assignment->user
                                ->last_login_at
                        )->toISOString(),
                    'trusted_devices_count' =>
                        $assignment->user
                            ->trustedDevices
                            ->whereNull('revoked_at')
                            ->count(),
                    'active_sessions_count' =>
                        $assignment->user
                            ->tokens()
                            ->count(),
                ],
                'branch' => $assignment->branch ? [
                    'id' => $assignment->branch->id,
                    'name' => $assignment->branch->name,
                ] : null,
                'roles' => $assignment->user->roles
                    ->filter(fn (Role $role) =>
                        (int) ($role->pivot->tenant_id ?? 0) === (int) $tenant->id
                        && ($role->pivot->status ?? 'active') === 'active'
                    )
                    ->map(fn (Role $role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                        'code' => $this->normalizeRequestedRoleCode($tenant, $role->code),
                        'stored_code' => $role->code,
                        'access_assignment_mode' =>
                            $this->roleAccessAssignmentMode(
                                $role
                            ),
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
            'access_assignment_mode' => [
                'nullable',
                'string',
                'in:predefined_role,granular_permissions',
            ],
            'role_code' => ['required', 'string', 'max:80'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:100'],
            'password' => ['nullable', 'string', 'min:8', 'max:100'],
            'branch_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,invited,suspended,inactive'],
            'two_factor_required' =>
                ['nullable', 'boolean'],        ]);

        $validated['access_assignment_mode'] =
            $this->resolveAccessAssignmentMode(
                $validated
            );

        $temporaryPassword = $validated['password'] ?? (Str::random(10) . '1!');

        $user = DB::transaction(function () use ($tenant, $validated, $temporaryPassword, $request) {
            $email = strtolower($validated['email']);

            abort_if(
                User::query()->where('email', $email)->exists(),
                422,
                'A user with this email address already exists.',
            );

            $user = new User();
            $user->email = $email;
            $user->name = $validated['name'];
            $user->phone = $validated['phone'] ?? null;
            $user->password = Hash::make($temporaryPassword);
            $user->forceFill([
                'must_change_password' => true,
                'two_factor_required' =>
                    (bool) (
                        $validated[
                            'two_factor_required'
                        ] ?? true
                    ),
            ]);
            $user->save();

            $assignment = TenantUser::query()->create([
                'tenant_id' => $tenant->id,
                'user_id' => $user->id,
                'branch_id' => $validated['branch_id'] ?? null,
                'job_title' => $validated['job_title'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'invited_by' => $request->user()?->id,
                'joined_at' => now(),
            ]);

            $role = $this->ensureTenantRole(
                $tenant,
                $validated[
                    'access_assignment_mode'
                ],
                $validated['role_code'],
                $validated['permissions'] ?? null,
                $user,
            );

            $existingTenantRoleIds = $user->roles()
                ->wherePivot('tenant_id', $tenant->id)
                ->get()
                ->pluck('id');

            foreach ($existingTenantRoleIds as $roleId) {
                $user->roles()->updateExistingPivot($roleId, ['status' => 'inactive']);
            }

            $assignmentStatus = $validated['status'] ?? 'active';

            $user->roles()->syncWithoutDetaching([
                $role->id => [
                    'tenant_id' => $tenant->id,
                    'solution_id' => null,
                    'branch_id' => $validated['branch_id'] ?? null,
                    'status' => in_array($assignmentStatus, ['active', 'invited'], true) ? 'active' : 'inactive',
                ],
            ]);

            return $user->fresh(['roles.permissions', 'tenantAssignments']);
        });

        $assignment = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        return response()->json([
            'message' => 'User created successfully for ' . $tenant->name . '.',
            'temporary_password' => $temporaryPassword,
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $assignment->status,
                'branch_id' => $assignment->branch_id,
                'job_title' => $assignment->job_title,
            ],
        ], 201);
    }
    public function update(Request $request, User $user): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $assignment = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:191'],
            'access_assignment_mode' => [
                'nullable',
                'string',
                'in:predefined_role,granular_permissions',
            ],
            'role_code' => ['required', 'string', 'max:80'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'max:100'],
            'branch_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:active,invited,suspended,inactive'],
            'two_factor_required' =>
                ['nullable', 'boolean'],        ]);

        $validated['access_assignment_mode'] =
            $this->resolveAccessAssignmentMode(
                $validated
            );

        $updatedUser = DB::transaction(function () use ($tenant, $assignment, $validated, $user) {
            $user->name = $validated['name'] ?? $user->name;
            $user->phone = array_key_exists(
                'phone',
                $validated
            )
                ? $validated['phone']
                : $user->phone;

            if (
                array_key_exists(
                    'two_factor_required',
                    $validated
                )
            ) {
                $user->two_factor_required =
                    (bool) $validated[
                        'two_factor_required'
                    ];
            }

            $user->save();

            $assignmentStatus = $validated['status'] ?? $assignment->status ?? 'active';

            $assignment->fill([
                'branch_id' => $validated['branch_id'] ?? $assignment->branch_id,
                'job_title' => array_key_exists('job_title', $validated)
                    ? $validated['job_title']
                    : $assignment->job_title,
                'status' => $assignmentStatus,
            ]);
            $assignment->save();

            $role = $this->ensureTenantRole(
                $tenant,
                $validated[
                    'access_assignment_mode'
                ],
                $validated['role_code'],
                $validated['permissions'] ?? null,
                $user,
            );

            $existingTenantRoleIds = $user->roles()
                ->wherePivot('tenant_id', $tenant->id)
                ->get()
                ->pluck('id');

            foreach ($existingTenantRoleIds as $roleId) {
                $user->roles()->updateExistingPivot($roleId, ['status' => 'inactive']);
            }

            $user->roles()->syncWithoutDetaching([
                $role->id => [
                    'tenant_id' => $tenant->id,
                    'solution_id' => null,
                    'branch_id' => $assignment->branch_id,
                    'status' => in_array($assignmentStatus, ['active', 'invited'], true) ? 'active' : 'inactive',
                ],
            ]);

            return $user->fresh(['roles.permissions', 'tenantAssignments']);
        });

        return response()->json([
            'message' => 'User profile, role, permissions and status updated successfully.',
            'user' => [
                'id' => $updatedUser->id,
                'name' => $updatedUser->name,
                'email' => $updatedUser->email,
                'phone' => $updatedUser->phone,
                'status' => $assignment->fresh()->status,
            ],
        ]);
    }


    public function deactivate(Request $request, User $user): JsonResponse
    {
        $tenant = $this->resolveTenant($request);

        $assignment = TenantUser::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        DB::transaction(function () use ($tenant, $assignment, $user) {
            $assignment->forceFill(['status' => 'inactive'])->save();

            $roleIds = $user->roles()
                ->wherePivot('tenant_id', $tenant->id)
                ->get()
                ->pluck('id');

            foreach ($roleIds as $roleId) {
                $user->roles()->updateExistingPivot($roleId, ['status' => 'inactive']);
            }
        });

        return response()->json([
            'message' => 'User access deactivated successfully. Audit history and business records were retained.',
        ]);
    }


    private function resolveTenant(Request $request): Tenant
    {
        $slug = $request->header('X-Tenant-Slug')
            ?: $request->header('X-Tenant')
            ?: $request->input('tenant_slug');

        abort_if(
            ! is_string($slug) || trim($slug) === '',
            422,
            'Tenant context is required.',
        );

        return Tenant::query()
            ->where('slug', trim($slug))
            ->where('status', 'active')
            ->firstOrFail();
    }
    /**
     * AQUILA_USER_ACCESS_ASSIGNMENT_MODES_20260712
     */
    private function resolveAccessAssignmentMode(
        array $validated,
    ): string {
        $mode = $validated[
            'access_assignment_mode'
        ] ?? (
            array_key_exists(
                'permissions',
                $validated,
            )
                ? 'granular_permissions'
                : 'predefined_role'
        );

        abort_if(
            $mode === 'predefined_role'
            && ! empty(
                $validated['permissions'] ?? []
            ),
            422,
            'Pre-defined role mode does not accept direct permissions.',
        );

        abort_if(
            $mode === 'granular_permissions'
            && empty(
                $validated['permissions'] ?? []
            ),
            422,
            'Select at least one permission for the Granular Permission Matrix.',
        );

        return $mode;
    }

    private function roleAccessAssignmentMode(
        Role $role,
    ): string {
        return preg_match(
            '/-custom-access-user-\d+$/',
            $role->code,
        ) === 1
            ? 'granular_permissions'
            : 'predefined_role';
    }

    private function ensureTenantRole(
        Tenant $tenant,
        string $accessAssignmentMode,
        string $requestedCode,
        ?array $requestedPermissions,
        ?User $user = null,
    ): Role {
        $templates = $this->roleTemplates();

        if (
            $accessAssignmentMode
            === 'predefined_role'
        ) {
            $templateCode =
                $this->normalizeRequestedRoleCode(
                    $tenant,
                    $requestedCode,
                );

            abort_unless(
                array_key_exists(
                    $templateCode,
                    $templates,
                ),
                422,
                'The selected pre-defined role is not available for this tenant.',
            );

            $template = $templates[$templateCode];

            $templatePermissions =
                OperationalPermissionContract::expand(
                    $template['permissions'],
                );

            $tenantRoleCode = Str::slug(
                $tenant->slug
                . '-'
                . $templateCode
            );

            $role = Role::query()->updateOrCreate(
                ['code' => $tenantRoleCode],
                [
                    'name' =>
                        $tenant->name
                        . ' '
                        . $template['name'],
                    'scope_type' => 'tenant',
                    'description' =>
                        $template['description'],
                    'status' => 'active',
                ],
            );

            $permissionIds = Permission::query()
                ->whereIn(
                    'code',
                    $templatePermissions,
                )
                ->where('status', 'active')
                ->pluck('id')
                ->all();

            $role->permissions()->sync(
                $permissionIds
            );

            return $role;
        }

        abort_unless(
            $user instanceof User,
            422,
            'A user is required for granular permission assignment.',
        );

        $permissions =
            $this->validateGranularPermissions(
                $requestedPermissions ?? [],
            );

        $tenantRoleCode = Str::slug(
            $tenant->slug
            . '-custom-access-user-'
            . $user->id
        );

        $role = Role::query()->updateOrCreate(
            ['code' => $tenantRoleCode],
            [
                'name' =>
                    $tenant->name
                    . ' Custom Access — '
                    . $user->name,
                'scope_type' => 'tenant',
                'description' =>
                    'Individual tenant-scoped access configured through the Granular Permission Matrix.',
                'status' => 'active',
            ],
        );

        $permissionIds = collect($permissions)
            ->map(
                fn (string $code) =>
                    Permission::query()
                        ->firstOrCreate(
                            ['code' => $code],
                            [
                                'name' =>
                                    Str::headline(
                                        str_replace(
                                            '.',
                                            ' ',
                                            $code,
                                        ),
                                    ),
                                'permission_group' =>
                                    str_contains(
                                        $code,
                                        'insurance',
                                    )
                                        ? 'insurance'
                                        : (
                                            str_contains(
                                                $code,
                                                'pharmaco',
                                            )
                                                ? 'pharmaco'
                                                : 'security'
                                        ),
                                'description' =>
                                    'Approved tenant permission for '
                                    . $code,
                                'status' => 'active',
                            ],
                        )
                        ->id,
            )
            ->values()
            ->all();

        $role->permissions()->sync(
            $permissionIds
        );

        return $role;
    }

    private function validateGranularPermissions(
        array $requestedPermissions,
    ): array {
        $permissions = collect(
            $requestedPermissions
        )
            ->filter(
                fn ($code) =>
                    is_string($code)
                    && trim($code) !== ''
            )
            ->map(
                fn (string $code) =>
                    trim(strtolower($code))
            )
            ->unique()
            ->values();

        abort_if(
            $permissions->isEmpty(),
            422,
            'Select at least one permission for the Granular Permission Matrix.',
        );

        $forbiddenExact = collect([
            'roles.manage',
            'tenant.roles.manage',
            'users.permissions.edit',
        ]);

        $forbiddenPrefixes = [
            'platform.',
            'system.',
            'tenants.',
            'solutions.',
        ];

        $forbidden = $permissions
            ->filter(
                function (
                    string $code
                ) use (
                    $forbiddenExact,
                    $forbiddenPrefixes,
                ): bool {
                    if (
                        $forbiddenExact->contains(
                            $code
                        )
                    ) {
                        return true;
                    }

                    foreach (
                        $forbiddenPrefixes
                        as $prefix
                    ) {
                        if (
                            str_starts_with(
                                $code,
                                $prefix,
                            )
                        ) {
                            return true;
                        }
                    }

                    return false;
                },
            )
            ->values();

        abort_if(
            $forbidden->isNotEmpty(),
            422,
            'Platform or tenant-administration permissions cannot be assigned through the Granular Permission Matrix.',
        );

        $approvedNamespaces = [
            'tenant.profile.',
            'pos.',
            'inventory.',
            'procurement.',
            'finance.',
            'reports.',
            'insurance.',
            'communications.',
            'notifications.',
            'ai.',
            'audit.',
            'pharmaco.',
            'general_items.',
            'security.audit.',
            'security.sessions.',
            'security.trusted_devices.',
            'security.two_factor.',
            'security.passwords.',
        ];

        $forbiddenGranularPrefixes = [
            'security.roles.',
            'security.permissions.',
            'security.users.',
            'tenant.roles.',
            'tenant.users.',
            'tenant.permissions.',
        ];

        $unknown = $permissions
            ->filter(
                function (
                    string $code
                ) use (
                    $approvedNamespaces,
                    $forbiddenGranularPrefixes,
                ): bool {
                    foreach (
                        $forbiddenGranularPrefixes
                        as $prefix
                    ) {
                        if (
                            str_starts_with(
                                $code,
                                $prefix,
                            )
                        ) {
                            return true;
                        }
                    }

                    foreach (
                        $approvedNamespaces
                        as $namespace
                    ) {
                        if (
                            str_starts_with(
                                $code,
                                $namespace,
                            )
                        ) {
                            return false;
                        }
                    }

                    return true;
                },
            )
            ->values();

        abort_if(
            $unknown->isNotEmpty(),
            422,
            'Unknown or unapproved granular permissions: '
            . $unknown->implode(', '),
        );

        return $permissions->all();
    }

    private function normalizeRequestedRoleCode(Tenant $tenant, string $requestedCode): string
    {
        $normalized = Str::slug($requestedCode);
        $tenantPrefix = Str::slug($tenant->slug) . '-';

        if (str_starts_with($normalized, $tenantPrefix)) {
            $normalized = substr($normalized, strlen($tenantPrefix));
        }

        if (
            preg_match(
                '/-custom-access-user-\d+$/',
                $normalized,
            ) === 1
        ) {
            return 'custom-access';
        }

        $normalized = preg_replace('/-user-\d+$/', '', $normalized) ?: $normalized;

        return array_key_exists($normalized, $this->roleTemplates())
            ? $normalized
            : 'support-assistant';
    }
}
