<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_account_mappings', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->string('mapping_key', 100);
            $table->unsignedBigInteger('finance_chart_of_account_id');
            $table->string('source_module', 50)->nullable();
            $table->string('source_type', 80)->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->string('currency_code', 3)->default('RWF');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'branch_id', 'mapping_key', 'currency_code'], 'finance_account_mappings_unique_scope');
            $table->index(['tenant_id', 'mapping_key']);
            $table->index(['tenant_id', 'source_module', 'source_type']);
            $table->foreign('finance_chart_of_account_id')->references('id')->on('finance_chart_of_accounts')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_account_mappings');
    }
};
