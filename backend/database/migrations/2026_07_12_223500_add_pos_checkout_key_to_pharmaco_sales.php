<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('pharmaco_sales', 'pos_checkout_key')) {
            Schema::table('pharmaco_sales', function (Blueprint $table): void {
                $table->string('pos_checkout_key', 100)
                    ->nullable()
                    ->after('uuid');

                $table->unique(
                    ['tenant_id', 'pos_checkout_key'],
                    'pharmaco_sales_tenant_checkout_unique'
                );
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('pharmaco_sales', 'pos_checkout_key')) {
            Schema::table('pharmaco_sales', function (Blueprint $table): void {
                $table->dropUnique(
                    'pharmaco_sales_tenant_checkout_unique'
                );

                $table->dropColumn('pos_checkout_key');
            });
        }
    }
};
