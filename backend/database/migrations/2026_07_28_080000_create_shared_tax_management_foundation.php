<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_types', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('country_code', 2)->default('RW');
            $table->string('code', 100);
            $table->string('name', 191);
            $table->string('tax_scope', 50);
            $table->string('calculation_method', 30)
                ->default('percentage');
            $table->string('recoverability', 30)
                ->default('non_recoverable');
            $table->string('status', 30)->default('active');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(
                ['country_code', 'code'],
                'tax_types_country_code_unique'
            );

            $table->index(
                ['country_code', 'tax_scope', 'status'],
                'tax_types_scope_status_idx'
            );
        });

        Schema::create('tax_rates', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('tax_type_id')
                ->constrained('tax_types')
                ->restrictOnDelete();

            $table->foreignId('tenant_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            $table->string('code', 100);
            $table->string('name', 191);

            $table->decimal('rate', 12, 6)->nullable();
            $table->decimal('fixed_amount', 18, 2)->nullable();
            $table->string('currency_code', 3)->default('RWF');

            $table->string('calculation_basis', 50)
                ->default('taxable_amount');

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->string('legal_reference', 191)->nullable();
            $table->text('source_url')->nullable();
            $table->char('source_document_sha256', 64)->nullable();

            $table->unsignedInteger('version')->default(1);
            $table->text('change_reason')->nullable();

            $table->string('status', 30)->default('draft');

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tax_type_id', 'tenant_id', 'status'],
                'tax_rates_type_tenant_status_idx'
            );

            $table->index(
                ['tax_type_id', 'tenant_id', 'code', 'version'],
                'tax_rates_type_scope_code_version_idx'
            );

            $table->index(
                ['effective_from', 'effective_to'],
                'tax_rates_effective_dates_idx'
            );
        });

        Schema::create('tax_profiles', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('tenant_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            $table->foreignId('tax_type_id')
                ->nullable()
                ->constrained('tax_types')
                ->nullOnDelete();

            $table->foreignId('default_tax_rate_id')
                ->nullable()
                ->constrained('tax_rates')
                ->nullOnDelete();

            $table->string('code', 100);
            $table->string('name', 191);

            $table->string('tax_treatment', 30);
            $table->boolean('requires_registry_match')
                ->default(false);
            $table->boolean('requires_hs_code')
                ->default(false);
            $table->boolean('requires_manual_approval')
                ->default(false);

            $table->unsignedInteger('version')->default(1);
            $table->text('change_reason')->nullable();

            $table->string('status', 30)->default('active');
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'code', 'status'],
                'tax_profiles_tenant_code_status_idx'
            );

            $table->index(
                ['tenant_id', 'code', 'version'],
                'tax_profiles_scope_code_version_idx'
            );
        });

        Schema::create('tax_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('tenant_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            $table->foreignId('tax_profile_id')
                ->constrained('tax_profiles')
                ->restrictOnDelete();

            $table->string('code', 100);
            $table->string('name', 191);

            $table->string('module_code', 50);
            $table->string('transaction_type', 50);

            $table->string('product_category_code', 100)
                ->nullable();

            $table->string('hs_code_prefix', 20)->nullable();
            $table->string('party_condition', 50)->nullable();

            $table->unsignedSmallInteger('priority')
                ->default(100);

            $table->json('conditions')->nullable();

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            $table->boolean('requires_manual_review')
                ->default(false);

            $table->string('legal_reference', 191)->nullable();

            $table->unsignedInteger('version')->default(1);
            $table->text('change_reason')->nullable();

            $table->string('status', 30)->default('draft');

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(
                ['tenant_id', 'module_code', 'transaction_type'],
                'tax_rules_tenant_module_tx_idx'
            );

            $table->index(
                ['product_category_code', 'hs_code_prefix'],
                'tax_rules_category_hs_idx'
            );

            $table->index(
                ['effective_from', 'effective_to', 'status'],
                'tax_rules_effective_status_idx'
            );

            $table->index(
                ['tenant_id', 'code', 'version'],
                'tax_rules_scope_code_version_idx'
            );
        });

        Schema::create(
            'rra_exemption_lists',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->string('code', 100)->unique();
                $table->string('title', 191);
                $table->string('list_type', 50)
                    ->default('pharmaceutical_vat_exemption');

                $table->string('issuing_authority', 191)
                    ->default('Ministry of Health');

                $table->string('approving_authority', 191)
                    ->default(
                        'Ministry of Finance and Economic Planning'
                    );

                $table->string('publishing_authority', 191)
                    ->default('Rwanda Revenue Authority');

                $table->string('version_label', 100);
                $table->date('publication_date')->nullable();
                $table->date('effective_from');
                $table->date('effective_to')->nullable();

                $table->text('source_url');
                $table->char('source_sha256', 64);
                $table->string('source_format', 30)
                    ->default('pdf');

                $table->string('import_status', 30)
                    ->default('pending');

                $table->unsignedInteger('record_count')
                    ->default(0);

                $table->foreignId('imported_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('imported_at')->nullable();
                $table->timestamp('approved_at')->nullable();

                $table->string('status', 30)->default('draft');
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    ['list_type', 'status', 'effective_from'],
                    'rra_lists_type_status_effective_idx'
                );
            }
        );

        Schema::create(
            'rra_exemption_items',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('rra_exemption_list_id')
                    ->constrained('rra_exemption_lists')
                    ->cascadeOnDelete();

                $table->unsignedInteger('sequence_number');

                $table->string('official_name', 191);
                $table->string('normalised_name', 191);

                $table->string('generic_name', 191)->nullable();
                $table->string('normalised_generic_name', 191)
                    ->nullable();

                $table->string('trade_name', 191)->nullable();
                $table->string('dosage_form', 100)->nullable();
                $table->string('strength', 100)->nullable();
                $table->string('pack_size', 100)->nullable();

                $table->string('registration_number', 100)
                    ->nullable();

                $table->string('hs_code', 20)->nullable();
                $table->string('manufacturer', 191)->nullable();

                $table->string('eligibility_scope', 50)
                    ->default('pharmaceutical_product');

                $table->string('status', 30)->default('active');
                $table->json('raw_payload')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'rra_exemption_list_id',
                        'sequence_number',
                    ],
                    'rra_items_list_sequence_unique'
                );

                $table->index(
                    [
                        'rra_exemption_list_id',
                        'normalised_name',
                    ],
                    'rra_items_list_name_idx'
                );

                $table->index(
                    [
                        'normalised_generic_name',
                        'dosage_form',
                    ],
                    'rra_items_generic_form_idx'
                );

                $table->index(
                    ['registration_number', 'hs_code'],
                    'rra_items_registration_hs_idx'
                );
            }
        );

        Schema::create(
            'rra_exemption_aliases',
            function (Blueprint $table): void {
                $table->id();

                $table->foreignId('rra_exemption_item_id')
                    ->constrained('rra_exemption_items')
                    ->cascadeOnDelete();

                $table->string('alias', 191);
                $table->string('normalised_alias', 191);
                $table->string('alias_type', 30)
                    ->default('alternative_name');

                $table->string('status', 30)->default('active');
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    [
                        'rra_exemption_item_id',
                        'normalised_alias',
                    ],
                    'rra_alias_item_name_unique'
                );

                $table->index(
                    ['normalised_alias', 'status'],
                    'rra_alias_name_status_idx'
                );
            }
        );

        Schema::create(
            'product_tax_assignments',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->foreignId('product_id')
                    ->constrained('products')
                    ->cascadeOnDelete();

                $table->foreignId('tax_profile_id')
                    ->nullable()
                    ->constrained('tax_profiles')
                    ->nullOnDelete();

                $table->foreignId('tax_rate_id')
                    ->nullable()
                    ->constrained('tax_rates')
                    ->nullOnDelete();

                $table->foreignId('rra_exemption_item_id')
                    ->nullable()
                    ->constrained('rra_exemption_items')
                    ->nullOnDelete();

                $table->string('business_category_code', 100)
                    ->nullable();

                $table->decimal(
                    'category_confidence',
                    5,
                    4
                )->nullable();

                $table->string('tax_treatment', 30)
                    ->default('review_required');

                $table->string('exemption_status', 30)
                    ->default('not_checked');

                $table->string('match_method', 30)->nullable();
                $table->decimal('match_score', 5, 4)->nullable();

                $table->string('review_status', 30)
                    ->default('pending');

                $table->string('source', 30)
                    ->default('manual');

                $table->text('reason')->nullable();

                $table->date('effective_from');
                $table->date('effective_to')->nullable();

                $table->unsignedInteger('version')->default(1);
                $table->string('status', 30)->default('active');

                $table->foreignId('reviewed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('reviewed_at')->nullable();

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('approved_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'product_id', 'version'],
                    'product_tax_product_version_unique'
                );

                $table->index(
                    ['tenant_id', 'product_id', 'status'],
                    'product_tax_product_status_idx'
                );

                $table->index(
                    ['review_status', 'exemption_status'],
                    'product_tax_review_exemption_idx'
                );

                $table->index(
                    ['effective_from', 'effective_to'],
                    'product_tax_effective_dates_idx'
                );
            }
        );

        Schema::create(
            'tax_calculation_snapshots',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->constrained()
                    ->cascadeOnDelete();

                $table->string('module_code', 50);
                $table->string('transaction_type', 50);

                $table->string('source_type', 50);
                $table->string('source_id', 100);
                $table->string('source_line_id', 100)->nullable();

                $table->foreignId('product_id')
                    ->nullable()
                    ->constrained('products')
                    ->nullOnDelete();

                $table->date('business_date');

                $table->foreignId('tax_rule_id')
                    ->nullable()
                    ->constrained('tax_rules')
                    ->nullOnDelete();

                $table->foreignId('tax_rate_id')
                    ->nullable()
                    ->constrained('tax_rates')
                    ->nullOnDelete();

                $table->foreignId('rra_exemption_list_id')
                    ->nullable()
                    ->constrained('rra_exemption_lists')
                    ->nullOnDelete();

                $table->foreignId('rra_exemption_item_id')
                    ->nullable()
                    ->constrained('rra_exemption_items')
                    ->nullOnDelete();

                $table->string('tax_type_code', 100);
                $table->string('tax_profile_code', 100);
                $table->string('tax_treatment', 30);

                $table->decimal('tax_rate', 12, 6)
                    ->default(0);

                $table->decimal('taxable_amount', 18, 2)
                    ->default(0);

                $table->decimal('tax_amount', 18, 2)
                    ->default(0);

                $table->string('currency_code', 3)
                    ->default('RWF');

                $table->string('idempotency_key', 100);

                $table->json('calculation_basis')->nullable();
                $table->json('source_snapshot')->nullable();

                $table->foreignId('created_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();

                $table->unique(
                    ['tenant_id', 'idempotency_key'],
                    'tax_snapshot_tenant_idempotency_unique'
                );

                $table->index(
                    [
                        'tenant_id',
                        'module_code',
                        'business_date',
                    ],
                    'tax_snapshot_tenant_module_date_idx'
                );

                $table->index(
                    ['source_type', 'source_id'],
                    'tax_snapshot_source_idx'
                );
            }
        );

        Schema::create(
            'tax_integration_endpoints',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tenant_id')
                    ->nullable()
                    ->constrained()
                    ->nullOnDelete();

                $table->string('provider_code', 50)
                    ->default('rra');

                $table->string('integration_type', 50);
                $table->string('name', 191);

                $table->text('base_url')->nullable();
                $table->string('auth_mode', 30)
                    ->default('none');

                $table->string('credentials_secret_ref', 191)
                    ->nullable();

                $table->string('status', 30)
                    ->default('disabled');

                $table->timestamp('last_sync_at')->nullable();
                $table->timestamp('last_success_at')->nullable();

                $table->json('configuration')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tenant_id',
                        'provider_code',
                        'integration_type',
                    ],
                    'tax_endpoint_provider_type_idx'
                );
            }
        );

        Schema::create(
            'tax_sync_runs',
            function (Blueprint $table): void {
                $table->id();
                $table->uuid('uuid')->unique();

                $table->foreignId('tax_integration_endpoint_id')
                    ->constrained('tax_integration_endpoints')
                    ->cascadeOnDelete();

                $table->string('sync_type', 50);
                $table->string('status', 30)
                    ->default('pending');

                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();

                $table->unsignedInteger('records_received')
                    ->default(0);

                $table->unsignedInteger('records_created')
                    ->default(0);

                $table->unsignedInteger('records_updated')
                    ->default(0);

                $table->unsignedInteger('records_rejected')
                    ->default(0);

                $table->char('source_sha256', 64)->nullable();
                $table->text('error_summary')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(
                    [
                        'tax_integration_endpoint_id',
                        'status',
                        'started_at',
                    ],
                    'tax_sync_endpoint_status_idx'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_sync_runs');
        Schema::dropIfExists('tax_integration_endpoints');
        Schema::dropIfExists('tax_calculation_snapshots');
        Schema::dropIfExists('product_tax_assignments');
        Schema::dropIfExists('rra_exemption_aliases');
        Schema::dropIfExists('rra_exemption_items');
        Schema::dropIfExists('rra_exemption_lists');
        Schema::dropIfExists('tax_rules');
        Schema::dropIfExists('tax_profiles');
        Schema::dropIfExists('tax_rates');
        Schema::dropIfExists('tax_types');
    }
};
