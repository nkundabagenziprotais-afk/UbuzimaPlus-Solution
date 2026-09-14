<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'hrm.analytics.view' => [
            'View HR Analytics',
            'View scoped HR analytics and aggregate workforce reports.',
        ],

        'hrm.analytics.manage' => [
            'Manage HR Reports',
            'Create, update and archive saved HR report definitions.',
        ],

        'hrm.analytics.export' => [
            'Export HR Analytics',
            'Export scoped aggregate HR analytics with audit logging.',
        ],

        'hrm.analytics.snapshot' => [
            'Capture HR Analytics Snapshot',
            'Capture a point-in-time scoped HR analytics snapshot.',
        ],
    ];

    public function up(): void
    {
        Schema::create(
            'hrm_analytics_saved_reports',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->foreignId('owner_user_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string('code', 100);
                $table->string('name', 191);

                $table->string('report_type', 50);

                $table->string('visibility', 30)
                    ->default('private');

                /*
                 * Encrypted report filters/configuration.
                 */
                $table->text('filters_payload')
                    ->nullable();

                $table->string('status', 30)
                    ->default('active');

                $table->timestamps();

                $table->unique(
                    [
                        'tenant_id',
                        'code',
                    ],
                    'hrm_analytics_report_code_uq'
                );

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'status',
                    ],
                    'hrm_analytics_report_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_analytics_snapshots',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->timestamp('captured_at');

                /*
                 * Encrypted aggregate metrics only.
                 */
                $table->text('metrics_payload');

                $table->foreignId('captured_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'captured_at',
                    ],
                    'hrm_analytics_snapshot_scope_idx'
                );
            }
        );

        Schema::create(
            'hrm_analytics_exports',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained('tenants')
                    ->cascadeOnDelete();

                $table->foreignId('branch_id')
                    ->nullable()
                    ->constrained('branches')
                    ->nullOnDelete();

                $table->string('report_type', 50);
                $table->string('format', 20)
                    ->default('csv');

                $table->unsignedInteger('row_count')
                    ->default(0);

                $table->string('checksum', 100)
                    ->nullable();

                $table->foreignId('requested_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('requested_at');

                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'branch_id',
                        'report_type',
                    ],
                    'hrm_analytics_export_scope_idx'
                );
            }
        );

        $now = now();

        foreach (
            self::PERMISSIONS
            as $code => [$name, $description]
        ) {
            $row = [
                'code' => $code,
                'name' => $name,
                'permission_group' => 'hrm',
                'description' => $description,
                'status' => 'active',
            ];

            if (
                Schema::hasColumn(
                    'permissions',
                    'created_at'
                )
            ) {
                $row['created_at'] = $now;
            }

            if (
                Schema::hasColumn(
                    'permissions',
                    'updated_at'
                )
            ) {
                $row['updated_at'] = $now;
            }

            DB::table('permissions')
                ->insert($row);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'hrm_analytics_exports'
        );

        Schema::dropIfExists(
            'hrm_analytics_snapshots'
        );

        Schema::dropIfExists(
            'hrm_analytics_saved_reports'
        );

        $permissionIds =
            DB::table('permissions')
                ->whereIn(
                    'code',
                    array_keys(
                        self::PERMISSIONS
                    )
                )
                ->pluck('id')
                ->all();

        if ($permissionIds) {
            DB::table('permission_role')
                ->whereIn(
                    'permission_id',
                    $permissionIds
                )
                ->delete();
        }

        DB::table('permissions')
            ->whereIn(
                'code',
                array_keys(
                    self::PERMISSIONS
                )
            )
            ->delete();
    }
};
