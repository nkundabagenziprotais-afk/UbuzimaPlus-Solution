<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_partners', function (Blueprint $table) {
            if (!Schema::hasColumn('insurance_partners', 'pricing_mode')) {
                $table->string('pricing_mode', 50)->default('standard');
            }

            if (!Schema::hasColumn('insurance_partners', 'contract_start_date')) {
                $table->date('contract_start_date')->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'contract_expiry_date')) {
                $table->date('contract_expiry_date')->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'default_customer_contribution_percent')) {
                $table->decimal('default_customer_contribution_percent', 8, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'default_insurer_contribution_percent')) {
                $table->decimal('default_insurer_contribution_percent', 8, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'coverage_limit')) {
                $table->decimal('coverage_limit', 15, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'required_documentation')) {
                $table->text('required_documentation')->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'invoice_claim_settings')) {
                $table->text('invoice_claim_settings')->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'external_portal_reference')) {
                $table->string('external_portal_reference', 191)->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'requires_price_approval')) {
                $table->boolean('requires_price_approval')->default(false);
            }

            if (!Schema::hasColumn('insurance_partners', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable();
            }

            if (!Schema::hasColumn('insurance_partners', 'updated_by')) {
                $table->unsignedBigInteger('updated_by')->nullable();
            }
        });

        Schema::table('insurance_price_lists', function (Blueprint $table) {
            if (!Schema::hasColumn('insurance_price_lists', 'source_type')) {
                $table->string('source_type', 50)->nullable();
            }

            if (!Schema::hasColumn('insurance_price_lists', 'source_document_path')) {
                $table->string('source_document_path', 191)->nullable();
            }

            if (!Schema::hasColumn('insurance_price_lists', 'approval_status')) {
                $table->string('approval_status', 30)->default('pending');
            }

            if (!Schema::hasColumn('insurance_price_lists', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable();
            }

            if (!Schema::hasColumn('insurance_price_lists', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }

            if (!Schema::hasColumn('insurance_price_lists', 'approval_notes')) {
                $table->text('approval_notes')->nullable();
            }
        });

        Schema::table('insurance_product_prices', function (Blueprint $table) {
            if (!Schema::hasColumn('insurance_product_prices', 'standard_selling_price_snapshot')) {
                $table->decimal('standard_selling_price_snapshot', 15, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'price_difference_amount')) {
                $table->decimal('price_difference_amount', 15, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'price_difference_percentage')) {
                $table->decimal('price_difference_percentage', 8, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'pricing_source')) {
                $table->string('pricing_source', 50)->default('contract_price_list');
            }

            if (!Schema::hasColumn('insurance_product_prices', 'price_confidence')) {
                $table->decimal('price_confidence', 5, 2)->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'last_used_at')) {
                $table->timestamp('last_used_at')->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'use_count')) {
                $table->unsignedInteger('use_count')->default(0);
            }

            if (!Schema::hasColumn('insurance_product_prices', 'approval_status')) {
                $table->string('approval_status', 30)->default('pending');
            }

            if (!Schema::hasColumn('insurance_product_prices', 'approved_by')) {
                $table->unsignedBigInteger('approved_by')->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'approved_at')) {
                $table->timestamp('approved_at')->nullable();
            }

            if (!Schema::hasColumn('insurance_product_prices', 'approval_notes')) {
                $table->text('approval_notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('insurance_product_prices', function (Blueprint $table) {
            $columns = [
                'standard_selling_price_snapshot',
                'price_difference_amount',
                'price_difference_percentage',
                'pricing_source',
                'price_confidence',
                'last_used_at',
                'use_count',
                'approval_status',
                'approved_by',
                'approved_at',
                'approval_notes',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('insurance_product_prices', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('insurance_price_lists', function (Blueprint $table) {
            $columns = [
                'source_type',
                'source_document_path',
                'approval_status',
                'approved_by',
                'approved_at',
                'approval_notes',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('insurance_price_lists', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('insurance_partners', function (Blueprint $table) {
            $columns = [
                'pricing_mode',
                'contract_start_date',
                'contract_expiry_date',
                'default_customer_contribution_percent',
                'default_insurer_contribution_percent',
                'coverage_limit',
                'required_documentation',
                'invoice_claim_settings',
                'external_portal_reference',
                'requires_price_approval',
                'created_by',
                'updated_by',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('insurance_partners', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
