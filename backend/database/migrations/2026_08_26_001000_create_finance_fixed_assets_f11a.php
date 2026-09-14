<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_fixed_assets',
            function (Blueprint $t): void {
                $t->id();

                $t->uuid(
                    'uuid'
                )->unique();

                $t->unsignedBigInteger(
                    'tenant_id'
                );

                $t->unsignedBigInteger(
                    'branch_id'
                )->nullable();

                $t->string(
                    'asset_number',
                    100
                );

                $t->string(
                    'name',
                    191
                );

                $t->string(
                    'asset_class',
                    50
                );

                $t->string(
                    'asset_mapping_key',
                    100
                );

                $t->date(
                    'acquisition_date'
                );

                $t->date(
                    'in_service_date'
                );

                $t->decimal(
                    'acquisition_cost',
                    18,
                    4
                );

                $t->decimal(
                    'salvage_value',
                    18,
                    4
                )->default(0);

                $t->unsignedSmallInteger(
                    'useful_life_months'
                );

                $t->string(
                    'depreciation_method',
                    30
                )->default(
                    'straight_line'
                );

                $t->decimal(
                    'declining_balance_rate',
                    9,
                    6
                )->nullable();

                $t->string(
                    'currency_code',
                    3
                )->default(
                    'RWF'
                );

                $t->string(
                    'status',
                    30
                )->default(
                    'active'
                );

                $t->string(
                    'serial_number',
                    100
                )->nullable();

                $t->string(
                    'location_name',
                    191
                )->nullable();

                $t->string(
                    'custodian_name',
                    191
                )->nullable();

                $t->string(
                    'purchase_reference',
                    100
                )->nullable();

                $t->date(
                    'warranty_expires_on'
                )->nullable();

                $t->text(
                    'notes'
                )->nullable();

                $t->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $t->unsignedBigInteger(
                    'updated_by'
                )->nullable();

                $t->json(
                    'metadata'
                )->nullable();

                $t->timestamps();

                $t->unique(
                    [
                        'tenant_id',
                        'asset_number',
                    ],
                    'fin_fixed_asset_tenant_number_uq'
                );

                $t->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'fin_fixed_asset_tenant_status_idx'
                );

                $t->index(
                    [
                        'tenant_id',
                        'asset_class',
                    ],
                    'fin_fixed_asset_tenant_class_idx'
                );

                $t->index(
                    [
                        'tenant_id',
                        'branch_id',
                    ],
                    'fin_fixed_asset_tenant_branch_idx'
                );
            }
        );

        Schema::create(
            'finance_fixed_asset_depreciation_schedules',
            function (Blueprint $t): void {
                $t->id();

                $t->uuid(
                    'uuid'
                )->unique();

                $t->unsignedBigInteger(
                    'tenant_id'
                );

                $t->unsignedBigInteger(
                    'fixed_asset_id'
                );

                $t->unsignedSmallInteger(
                    'period_number'
                );

                $t->date(
                    'period_start'
                );

                $t->date(
                    'period_end'
                );

                $t->decimal(
                    'opening_book_value',
                    18,
                    4
                );

                $t->decimal(
                    'depreciation_amount',
                    18,
                    4
                );

                $t->decimal(
                    'accumulated_depreciation',
                    18,
                    4
                );

                $t->decimal(
                    'closing_book_value',
                    18,
                    4
                );

                $t->string(
                    'status',
                    30
                )->default(
                    'planned'
                );

                $t->unsignedBigInteger(
                    'journal_entry_id'
                )->nullable();

                $t->unsignedBigInteger(
                    'posted_by'
                )->nullable();

                $t->timestamp(
                    'posted_at'
                )->nullable();

                $t->json(
                    'metadata'
                )->nullable();

                $t->timestamps();

                $t->unique(
                    [
                        'fixed_asset_id',
                        'period_number',
                    ],
                    'fin_fixed_dep_asset_period_uq'
                );

                $t->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'fin_fixed_dep_tenant_status_idx'
                );

                $t->index(
                    [
                        'tenant_id',
                        'period_start',
                    ],
                    'fin_fixed_dep_tenant_start_idx'
                );
            }
        );

        Schema::create(
            'finance_fixed_asset_disposals',
            function (Blueprint $t): void {
                $t->id();

                $t->uuid(
                    'uuid'
                )->unique();

                $t->unsignedBigInteger(
                    'tenant_id'
                );

                $t->unsignedBigInteger(
                    'fixed_asset_id'
                );

                $t->date(
                    'disposal_date'
                );

                $t->string(
                    'disposal_type',
                    30
                );

                $t->decimal(
                    'proceeds_amount',
                    18,
                    4
                )->default(0);

                $t->decimal(
                    'book_value_at_disposal',
                    18,
                    4
                );

                $t->decimal(
                    'gain_loss',
                    18,
                    4
                );

                $t->string(
                    'status',
                    30
                )->default(
                    'draft'
                );

                $t->unsignedBigInteger(
                    'journal_entry_id'
                )->nullable();

                $t->unsignedBigInteger(
                    'created_by'
                )->nullable();

                $t->unsignedBigInteger(
                    'approved_by'
                )->nullable();

                $t->json(
                    'metadata'
                )->nullable();

                $t->timestamps();

                $t->index(
                    [
                        'tenant_id',
                        'status',
                    ],
                    'fin_fixed_disp_tenant_status_idx'
                );

                $t->index(
                    [
                        'tenant_id',
                        'fixed_asset_id',
                    ],
                    'fin_fixed_disp_tenant_asset_idx'
                );
            }
        );

        Schema::create(
            'finance_fixed_asset_actions',
            function (Blueprint $t): void {
                $t->id();

                $t->uuid(
                    'uuid'
                )->unique();

                $t->unsignedBigInteger(
                    'tenant_id'
                );

                $t->unsignedBigInteger(
                    'fixed_asset_id'
                );

                $t->unsignedBigInteger(
                    'actor_id'
                )->nullable();

                $t->string(
                    'action',
                    30
                );

                $t->json(
                    'before_snapshot'
                )->nullable();

                $t->json(
                    'after_snapshot'
                )->nullable();

                $t->json(
                    'metadata'
                )->nullable();

                $t->timestamps();

                $t->index(
                    [
                        'tenant_id',
                        'fixed_asset_id',
                    ],
                    'fin_fixed_action_tenant_asset_idx'
                );

                $t->index(
                    [
                        'tenant_id',
                        'action',
                    ],
                    'fin_fixed_action_tenant_action_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_fixed_asset_actions'
        );

        Schema::dropIfExists(
            'finance_fixed_asset_disposals'
        );

        Schema::dropIfExists(
            'finance_fixed_asset_depreciation_schedules'
        );

        Schema::dropIfExists(
            'finance_fixed_assets'
        );
    }
};
