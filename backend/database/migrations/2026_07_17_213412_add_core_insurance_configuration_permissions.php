<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * Intentional no-op.
         *
         * This migration was generated for Phase 2 insurance permissions,
         * but the actual permission insert/update logic was placed in:
         * 2026_07_17_xxxxxx_add_core_insurance_configuration_permissions.php
         *
         * The file is retained because it has already been recorded in the
         * migrations table on the current environment.
         */
    }

    public function down(): void
    {
        /*
         * No-op rollback.
         */
    }
};
