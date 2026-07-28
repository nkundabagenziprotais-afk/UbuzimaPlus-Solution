<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->foreignId('business_category_id')
                ->nullable()
                ->after('product_category_id')
                ->constrained('product_categories')
                ->nullOnDelete();

            $table->string('hs_code', 20)
                ->nullable()
                ->after('registration_number');

            $table->string('tax_classification_status', 30)
                ->default('unreviewed')
                ->after('hs_code');

            $table->unsignedInteger('tax_classification_version')
                ->default(0)
                ->after('tax_classification_status');

            $table->index(
                ['tenant_id', 'business_category_id'],
                'products_tenant_business_category_idx'
            );

            $table->index(
                ['tenant_id', 'hs_code'],
                'products_tenant_hs_code_idx'
            );

            $table->index(
                ['tenant_id', 'tax_classification_status'],
                'products_tenant_tax_status_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex(
                'products_tenant_business_category_idx'
            );

            $table->dropIndex(
                'products_tenant_hs_code_idx'
            );

            $table->dropIndex(
                'products_tenant_tax_status_idx'
            );

            $table->dropForeign(
                ['business_category_id']
            );

            $table->dropColumn([
                'business_category_id',
                'hs_code',
                'tax_classification_status',
                'tax_classification_version',
            ]);
        });
    }
};
