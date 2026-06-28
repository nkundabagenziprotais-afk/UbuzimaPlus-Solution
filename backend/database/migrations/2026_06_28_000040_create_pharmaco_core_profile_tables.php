<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pharmacy_profiles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('legal_name');
            $table->string('trading_name');
            $table->string('pharmacy_category')->default('retail_pharmacy');
            $table->string('ownership_type')->nullable();
            $table->string('license_number')->nullable();
            $table->string('tin')->nullable();
            $table->string('rssb_provider_code')->nullable();
            $table->string('insurance_partner_code')->nullable();
            $table->string('regulator_name')->default('Rwanda FDA');
            $table->string('primary_contact_name')->nullable();
            $table->string('primary_phone')->nullable();
            $table->string('primary_email')->nullable();
            $table->string('website')->nullable();
            $table->string('country')->default('Rwanda');
            $table->string('city')->nullable();
            $table->string('district')->nullable();
            $table->string('sector')->nullable();
            $table->string('physical_address')->nullable();
            $table->json('capabilities')->nullable();
            $table->json('insurance_partners')->nullable();
            $table->json('operating_hours')->nullable();
            $table->json('metadata')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_primary')->default(true);
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'pharmacy_category']);
        });

        Schema::create('branch_departments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('department_type')->default('operations');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->time('opening_time')->nullable();
            $table->time('closing_time')->nullable();
            $table->boolean('is_revenue_center')->default(false);
            $table->string('operating_status')->default('active');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'code'], 'branch_departments_branch_code_unique');
            $table->index(['tenant_id', 'operating_status'], 'branch_departments_tenant_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_departments');
        Schema::dropIfExists('pharmacy_profiles');
    }
};
