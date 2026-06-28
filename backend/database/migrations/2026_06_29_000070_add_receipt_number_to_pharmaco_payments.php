<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pharmaco_payments', function (Blueprint $table) {
            $table->string('receipt_number', 120)->nullable()->after('reference_number');

            $table->unique(['tenant_id', 'receipt_number'], 'pharmaco_payments_tenant_receipt_unique');
        });
    }

    public function down(): void
    {
        Schema::table('pharmaco_payments', function (Blueprint $table) {
            $table->dropUnique('pharmaco_payments_tenant_receipt_unique');
            $table->dropColumn('receipt_number');
        });
    }
};
