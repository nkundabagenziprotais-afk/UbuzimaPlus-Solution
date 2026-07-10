<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HistoricalPosFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_historical_pos_schema_is_available(): void
    {
        $this->seed();

        $this->assertTrue(
            Schema::hasTable(
                'pharmaco_pos_historical_approvals'
            )
        );

        $contracts = [
            'pharmaco_pos_sessions' => [
                'session_mode',
                'historical_reason',
                'historical_reference',
                'historical_approval_id',
            ],
            'pharmaco_sales' => [
                'pos_session_id',
                'entry_mode',
                'business_date',
                'historical_reason',
                'historical_reference',
                'historical_approval_id',
            ],
            'pharmaco_payments' => [
                'pos_session_id',
                'business_date',
                'entry_mode',
                'historical_approval_id',
            ],
            'stock_movements' => [
                'pos_session_id',
                'business_date',
                'entry_mode',
                'historical_approval_id',
            ],
        ];

        foreach ($contracts as $table => $columns) {
            foreach ($columns as $column) {
                $this->assertTrue(
                    Schema::hasColumn($table, $column),
                    "Missing {$table}.{$column}"
                );
            }
        }
    }

    public function test_historical_permissions_are_seeded(): void
    {
        $this->seed();

        foreach ([
            'pharmaco.pos.historical.view',
            'pharmaco.pos.historical.open',
            'pharmaco.pos.historical.record',
            'pharmaco.pos.historical.approve',
        ] as $code) {
            $this->assertDatabaseHas(
                'permissions',
                [
                    'code' => $code,
                    'status' => 'active',
                ]
            );
        }
    }

    public function test_approval_is_restricted_to_admin_roles(): void
    {
        $this->seed();

        $permission = Permission::query()
            ->where(
                'code',
                'pharmaco.pos.historical.approve'
            )
            ->firstOrFail();

        foreach ([
            'ubuzima_plus_super_admin',
            'pharmaco360_solution_admin',
            'tenant_admin',
        ] as $roleCode) {
            $role = Role::query()
                ->where('code', $roleCode)
                ->firstOrFail();

            $this->assertTrue(
                $role->permissions()
                    ->whereKey($permission->id)
                    ->exists()
            );
        }

        foreach ([
            'branch_manager',
            'pharmacist',
            'cashier',
        ] as $roleCode) {
            $role = Role::query()
                ->where('code', $roleCode)
                ->firstOrFail();

            $this->assertFalse(
                $role->permissions()
                    ->whereKey($permission->id)
                    ->exists()
            );
        }
    }
}
