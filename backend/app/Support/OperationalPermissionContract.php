<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Keeps the established PharmaCo permission vocabulary compatible with
 * the detailed menu, dashboard and action-level permission vocabulary.
 *
 * Legacy permissions remain valid API authorities. Granular permissions
 * describe exactly which workspaces and controls the user should see.
 */
final class OperationalPermissionContract
{
    /**
     * @return array<string, list<string>>
     */
    public static function aliases(): array
    {
        return [
            'tenant.dashboard.view' => [
                'dashboard.view',
            ],

            'pharmaco.pos.use' => [
                'pos.sales.view',
                'pos.receipts.view',
                'pos.payments.view',
                'pos.cashier_close.view',
            ],
            'pharmaco.pos.open_session' => [
                'pos.sales.add',
                'pos.cashier_close.add',
            ],
            'pharmaco.pos.close_session' => [
                'pos.cashier_close.edit',
            ],
            'pharmaco.pos.session.reset' => [
                'pos.session_support.view',
                'pos.session_support.edit',
            ],

            'pharmaco.sales.view' => [
                'pos.sales.view',
                'pos.receipts.view',
                'pos.returns.view',
                'pos.payments.view',
                'reports.sales.view',
            ],
            'pharmaco.sales.create' => [
                'pos.sales.view',
                'pos.sales.add',
                'pos.receipts.view',
                'pos.receipts.add',
                'pos.payments.view',
                'pos.payments.add',
            ],
            'pharmaco.sales.manage' => [
                'pos.sales.view',
                'pos.sales.add',
                'pos.sales.edit',
                'pos.receipts.view',
                'pos.receipts.add',
                'pos.returns.view',
                'pos.returns.add',
                'pos.returns.edit',
                'pos.payments.view',
                'pos.payments.add',
                'pos.payments.edit',
                'pos.cashier_close.view',
                'pos.cashier_close.add',
                'pos.cashier_close.edit',
                'reports.sales.view',
            ],
            'pharmaco.sales.return' => [
                'pos.returns.view',
                'pos.returns.add',
            ],
            'pharmaco.sales.receipt.reprint' => [
                'pos.receipts.view',
                'pos.receipts.add',
            ],
            'pharmaco.customers.view' => [
                'pos.customers.view',
            ],
            'pharmaco.insurance.manage' => [
                'pos.insurance.view',
            ],

            'pharmaco.inventory.view' => [
                'inventory.dashboard.view',
                'inventory.products.view',
                'inventory.batches.view',
                'inventory.locations.view',
                'inventory.low_stock.view',
                'inventory.expiry_review.view',
                'inventory.table_settings.view',
                'inventory.expiry_labels.view',
                'reports.inventory.view',
            ],
            'pharmaco.inventory.manage' => [
                'inventory.dashboard.view',
                'inventory.products.view',
                'inventory.products.add',
                'inventory.products.edit',
                'inventory.batches.view',
                'inventory.batches.add',
                'inventory.batches.edit',
                'inventory.receiving.view',
                'inventory.receiving.add',
                'inventory.locations.view',
                'inventory.locations.add',
                'inventory.locations.edit',
                'inventory.low_stock.view',
                'inventory.expiry_review.view',
                'inventory.expiry_review.edit',
                'inventory.table_settings.view',
                'inventory.table_settings.edit',
                'inventory.expiry_labels.view',
                'inventory.expiry_labels.add',
                'reports.inventory.view',
            ],
            'pharmaco.product_master.view' => [
                'inventory.products.view',
            ],
            'pharmaco.product_master.manage' => [
                'inventory.products.view',
                'inventory.products.add',
                'inventory.products.edit',
                'inventory.products.delete',
            ],
            'pharmaco.products.manage' => [
                'inventory.products.view',
                'inventory.products.add',
                'inventory.products.edit',
                'inventory.products.delete',
            ],
            'pharmaco.product_inventory.receive' => [
                'inventory.receiving.view',
                'inventory.receiving.add',
                'inventory.batches.view',
                'inventory.batches.add',
            ],
            'pharmaco.product_inventory.update' => [
                'inventory.batches.view',
                'inventory.batches.edit',
            ],
            'pharmaco.inventory.low_stock.view' => [
                'inventory.low_stock.view',
            ],
            'pharmaco.inventory.batch_expiry.view' => [
                'inventory.expiry_review.view',
                'inventory.expiry_labels.view',
            ],
            'pharmaco.inventory.batch_expiry.manage' => [
                'inventory.expiry_review.view',
                'inventory.expiry_review.edit',
                'inventory.expiry_labels.view',
                'inventory.expiry_labels.add',
            ],

            'pharmaco.procurement.view' => [
                'procurement.suppliers.view',
                'procurement.purchase_orders.view',
                'procurement.receiving.view',
                'reports.procurement.view',
            ],
            'pharmaco.suppliers.manage' => [
                'procurement.suppliers.view',
                'procurement.suppliers.add',
                'procurement.suppliers.edit',
            ],
            'pharmaco.procurement.suppliers.manage' => [
                'procurement.suppliers.view',
                'procurement.suppliers.add',
                'procurement.suppliers.edit',
            ],
            'pharmaco.procurement.purchase_order.create' => [
                'procurement.purchase_orders.view',
                'procurement.purchase_orders.add',
            ],
            'pharmaco.procurement.purchase_order.approve' => [
                'procurement.purchase_orders.view',
                'procurement.purchase_orders.edit',
            ],
            'pharmaco.procurement.purchase_order.receive' => [
                'procurement.receiving.view',
                'procurement.receiving.add',
            ],

            'pharmaco.finance.view' => [
                'finance.dashboard.view',
                'finance.payables.view',
                'finance.receivables.view',
                'finance.payments.view',
                'finance.reconciliation.view',
                'reports.finance.view',
            ],
            'pharmaco.finance.receivables.manage' => [
                'finance.receivables.view',
                'finance.receivables.add',
                'finance.receivables.edit',
            ],
            'pharmaco.finance.payables.manage' => [
                'finance.payables.view',
                'finance.payables.add',
                'finance.payables.edit',
            ],
            'pharmaco.finance.reconciliation.manage' => [
                'finance.reconciliation.view',
                'finance.reconciliation.add',
                'finance.reconciliation.edit',
            ],
            'pharmaco.procurement.payment.view' => [
                'finance.payments.view',
            ],
            'pharmaco.procurement.payment.manage' => [
                'finance.payments.view',
                'finance.payments.add',
                'finance.payments.edit',
            ],

            'pharmaco.reports.view' => [
                'reports.sales.view',
                'reports.inventory.view',
                'reports.procurement.view',
                'reports.finance.view',
            ],
            'pharmaco.reports.sales' => [
                'reports.sales.view',
            ],
            'pharmaco.reports.inventory' => [
                'reports.inventory.view',
            ],
            'pharmaco.reports.procurement' => [
                'reports.procurement.view',
            ],
            'pharmaco.reports.finance' => [
                'reports.finance.view',
            ],
            'pharmaco.reports.audit' => [
                'reports.audit.view',
            ],

            'branches.view' => [
                'tenant.branches.view',
            ],
            'users.view' => [
                'users.staff.view',
            ],
            'users.manage' => [
                'users.staff.view',
                'security.users.view',
                'security.users.add',
                'security.users.edit',
                'security.users.delete',
            ],
            'tenant.roles.manage' => [
                'users.staff.view',
                'security.users.view',
                'security.users.add',
                'security.users.edit',
                'security.roles.view',
                'security.permissions.view',
            ],
            'roles.manage' => [
                'users.staff.view',
                'security.users.view',
                'security.users.add',
                'security.users.edit',
                'security.users.delete',
                'security.roles.view',
                'security.roles.add',
                'security.roles.edit',
                'security.roles.delete',
                'security.permissions.view',
                'security.permissions.add',
                'security.permissions.edit',
                'security.permissions.delete',
            ],

            'notifications.view' => [
                'communications.notifications.view',
            ],
            'notifications.manage' => [
                'communications.notifications.view',
                'communications.notifications.add',
                'communications.notifications.edit',
            ],
            'communications.email.use' => [
                'communications.email.view',
            ],
            'pharmaco.chat.manage' => [
                'communications.chat.view',
            ],
        ];
    }

    /**
     * @param array<int, string> $permissions
     * @return list<string>
     */
    public static function expand(array $permissions): array
    {
        $normalized = collect($permissions)
            ->filter(fn ($permission) => is_string($permission))
            ->map(fn (string $permission) => trim(strtolower($permission)))
            ->filter()
            ->unique()
            ->values();

        $expanded = $normalized->flatMap(
            fn (string $permission) => [
                $permission,
                ...(self::aliases()[$permission] ?? []),
            ],
        );

        return $expanded
            ->map(fn (string $permission) => trim(strtolower($permission)))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @return array<string, array{name: string, group: string}>
     */
    public static function definitions(): array
    {
        return collect(self::aliases())
            ->flatten()
            ->unique()
            ->sort()
            ->mapWithKeys(function (string $code): array {
                $group = Str::before($code, '.');

                return [
                    $code => [
                        'name' => Str::headline(
                            str_replace(['.', '_'], ' ', $code),
                        ),
                        'group' => $group,
                    ],
                ];
            })
            ->all();
    }
}
