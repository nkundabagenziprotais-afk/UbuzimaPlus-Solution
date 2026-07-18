<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurance_partners', function (Blueprint $table): void {
            if (! Schema::hasColumn('insurance_partners', 'alternative_phone')) {
                $table->string('alternative_phone', 80)
                    ->nullable()
                    ->after('contact_phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('insurance_partners', function (Blueprint $table): void {
            if (Schema::hasColumn('insurance_partners', 'alternative_phone')) {
                $table->dropColumn('alternative_phone');
            }
        });
    }
};
