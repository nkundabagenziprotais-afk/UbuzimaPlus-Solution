<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_claims', function (Blueprint $table): void {
            $table->unique(
                [
                    'tenant_id',
                    'sale_id',
                    'customer_insurance_membership_id',
                ],
                'insurance_claims_sale_membership_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('insurance_claims', function (Blueprint $table): void {
            $table->dropUnique(
                'insurance_claims_sale_membership_unique'
            );
        });
    }
};
