<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insurance_partners', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 80);
            $table->string('partner_type', 60)->default('insurer');
            $table->string('registration_number')->nullable();
            $table->string('tax_identification_number')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone', 80)->nullable();
            $table->string('claims_email')->nullable();
            $table->string('currency', 3)->default('RWF');
            $table->string('status', 40)->default('active');
            $table->boolean('is_default')->default(false);
            $table->json('integration_settings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('insurance_institutions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 100);
            $table->string('institution_type', 60)->default('employer');
            $table->string('registration_number')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone', 80)->nullable();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'insurance_partner_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('insurance_schemes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_institution_id')
                ->nullable()
                ->constrained('insurance_institutions')
                ->nullOnDelete();
            $table->string('name');
            $table->string('code', 100);
            $table->string('scheme_type', 60)->default('medical');
            $table->decimal('annual_limit', 18, 2)->nullable();
            $table->decimal('per_visit_limit', 18, 2)->nullable();
            $table->decimal('default_customer_contribution_percent', 7, 4)
                ->default(0);
            $table->decimal('default_insurer_contribution_percent', 7, 4)
                ->default(100);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('coverage_settings')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'insurance_partner_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('insurance_price_lists', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_scheme_id')
                ->nullable()
                ->constrained('insurance_schemes')
                ->nullOnDelete();
            $table->string('name');
            $table->string('code', 100);
            $table->string('currency', 3)->default('RWF');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->integer('priority')->default(100);
            $table->string('status', 40)->default('draft');
            $table->boolean('is_default')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'insurance_partner_id', 'code']);
            $table->index([
                'tenant_id',
                'insurance_partner_id',
                'status',
                'effective_from',
            ], 'insurance_price_lists_resolution_index');
        });

        Schema::create('insurance_product_prices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_price_list_id')
                ->constrained('insurance_price_lists')
                ->cascadeOnDelete();
            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();
            $table->decimal('agreed_unit_price', 18, 4);
            $table->decimal('maximum_claimable_price', 18, 4)->nullable();
            $table->decimal('customer_contribution_percent', 7, 4)->nullable();
            $table->decimal('insurer_contribution_percent', 7, 4)->nullable();
            $table->boolean('requires_pre_authorization')->default(false);
            $table->boolean('is_covered')->default(true);
            $table->string('coverage_status', 40)->default('covered');
            $table->json('restrictions')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique([
                'tenant_id',
                'insurance_price_list_id',
                'product_id',
            ], 'insurance_product_prices_unique');

            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('insurance_contribution_rules', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_scheme_id')
                ->nullable()
                ->constrained('insurance_schemes')
                ->cascadeOnDelete();
            $table->foreignId('insurance_institution_id')
                ->nullable()
                ->constrained('insurance_institutions')
                ->cascadeOnDelete();
            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->cascadeOnDelete();
            $table->string('rule_name');
            $table->string('rule_scope', 60)->default('partner');
            $table->decimal('customer_contribution_percent', 7, 4);
            $table->decimal('insurer_contribution_percent', 7, 4);
            $table->decimal('fixed_customer_amount', 18, 2)->nullable();
            $table->decimal('maximum_insurer_amount', 18, 2)->nullable();
            $table->integer('priority')->default(100);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('conditions')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index([
                'tenant_id',
                'insurance_partner_id',
                'status',
                'priority',
            ], 'insurance_contribution_resolution_index');
        });

        Schema::create('customer_insurance_memberships', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('customer_id');
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_scheme_id')
                ->nullable()
                ->constrained('insurance_schemes')
                ->nullOnDelete();
            $table->foreignId('insurance_institution_id')
                ->nullable()
                ->constrained('insurance_institutions')
                ->nullOnDelete();
            $table->string('member_number');
            $table->string('policy_number')->nullable();
            $table->string('principal_member_number')->nullable();
            $table->string('relationship_to_principal', 60)->nullable();
            $table->date('coverage_from')->nullable();
            $table->date('coverage_to')->nullable();
            $table->string('verification_status', 40)->default('pending');
            $table->timestamp('verified_at')->nullable();
            $table->unsignedBigInteger('verified_by')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('eligibility_response')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique([
                'tenant_id',
                'insurance_partner_id',
                'member_number',
            ], 'customer_insurance_memberships_unique');

            $table->index(['tenant_id', 'customer_id']);
        });

        Schema::create('insurance_agreements', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_institution_id')
                ->nullable()
                ->constrained('insurance_institutions')
                ->nullOnDelete();
            $table->string('agreement_number');
            $table->string('title');
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->integer('payment_terms_days')->default(30);
            $table->integer('claim_submission_deadline_days')->default(30);
            $table->decimal('credit_limit', 18, 2)->nullable();
            $table->string('status', 40)->default('draft');
            $table->string('document_path')->nullable();
            $table->json('terms')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'agreement_number']);
        });

        Schema::create('insurance_claims', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_scheme_id')
                ->nullable()
                ->constrained('insurance_schemes')
                ->nullOnDelete();
            $table->foreignId('customer_insurance_membership_id')
                ->nullable()
                ->constrained('customer_insurance_memberships')
                ->nullOnDelete();
            $table->unsignedBigInteger('sale_id')->nullable();
            $table->string('claim_number');
            $table->string('external_claim_reference')->nullable();
            $table->date('service_date');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('adjudicated_at')->nullable();
            $table->decimal('gross_amount', 18, 2)->default(0);
            $table->decimal('customer_amount', 18, 2)->default(0);
            $table->decimal('claimed_amount', 18, 2)->default(0);
            $table->decimal('approved_amount', 18, 2)->default(0);
            $table->decimal('rejected_amount', 18, 2)->default(0);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->string('status', 50)->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->json('submission_payload')->nullable();
            $table->json('adjudication_response')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'claim_number']);
            $table->index([
                'tenant_id',
                'insurance_partner_id',
                'status',
                'service_date',
            ], 'insurance_claims_worklist_index');
        });

        Schema::create('insurance_claim_lines', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_claim_id')
                ->constrained('insurance_claims')
                ->cascadeOnDelete();
            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();
            $table->unsignedBigInteger('sale_item_id')->nullable();
            $table->string('description');
            $table->decimal('quantity', 18, 4)->default(1);
            $table->decimal('unit_price', 18, 4)->default(0);
            $table->decimal('gross_amount', 18, 2)->default(0);
            $table->decimal('customer_amount', 18, 2)->default(0);
            $table->decimal('claimed_amount', 18, 2)->default(0);
            $table->decimal('approved_amount', 18, 2)->default(0);
            $table->decimal('rejected_amount', 18, 2)->default(0);
            $table->string('status', 40)->default('pending');
            $table->string('rejection_code')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'insurance_claim_id']);
        });

        Schema::create('insurance_reconciliation_batches', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->string('batch_number');
            $table->date('period_from');
            $table->date('period_to');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->unsignedInteger('claim_count')->default(0);
            $table->decimal('submitted_amount', 18, 2)->default(0);
            $table->decimal('approved_amount', 18, 2)->default(0);
            $table->decimal('rejected_amount', 18, 2)->default(0);
            $table->decimal('paid_amount', 18, 2)->default(0);
            $table->string('status', 40)->default('draft');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'batch_number']);
        });

        Schema::create('insurance_payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('insurance_partner_id')
                ->constrained('insurance_partners')
                ->cascadeOnDelete();
            $table->foreignId('insurance_reconciliation_batch_id')
                ->nullable()
                ->constrained('insurance_reconciliation_batches')
                ->nullOnDelete();
            $table->string('payment_reference');
            $table->date('payment_date');
            $table->decimal('amount', 18, 2);
            $table->string('currency', 3)->default('RWF');
            $table->string('payment_method', 60)->nullable();
            $table->string('bank_reference')->nullable();
            $table->string('status', 40)->default('received');
            $table->json('allocation_details')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'payment_reference']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurance_payments');
        Schema::dropIfExists('insurance_reconciliation_batches');
        Schema::dropIfExists('insurance_claim_lines');
        Schema::dropIfExists('insurance_claims');
        Schema::dropIfExists('insurance_agreements');
        Schema::dropIfExists('customer_insurance_memberships');
        Schema::dropIfExists('insurance_contribution_rules');
        Schema::dropIfExists('insurance_product_prices');
        Schema::dropIfExists('insurance_price_lists');
        Schema::dropIfExists('insurance_schemes');
        Schema::dropIfExists('insurance_institutions');
        Schema::dropIfExists('insurance_partners');
    }
};
