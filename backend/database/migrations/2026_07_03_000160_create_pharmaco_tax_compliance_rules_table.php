<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmaco_tax_compliance_rules', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('code', 120);
            $table->string('name');
            $table->string('applies_to', 80)->default('all_products');
            $table->string('product_type', 80)->nullable();
            $table->decimal('tax_rate', 8, 4)->default(0);
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->string('status', 40)->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'code'], 'pharmaco_tax_rules_tenant_code_unique');
            $table->index(['tenant_id', 'status'], 'pharmaco_tax_rules_tenant_status_index');
            $table->index(['tenant_id', 'applies_to'], 'pharmaco_tax_rules_tenant_applies_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pharmaco_tax_compliance_rules');
    }
};
