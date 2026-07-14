<?php

declare(strict_types=1);

use App\Services\Inventory\ProductMasterCorrectionService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(
            ProductMasterCorrectionService::class
        )->applyForTenantSlug('vitapharma');
    }

    public function down(): void
    {
        app(
            ProductMasterCorrectionService::class
        )->revertForTenantSlug('vitapharma');
    }
};
