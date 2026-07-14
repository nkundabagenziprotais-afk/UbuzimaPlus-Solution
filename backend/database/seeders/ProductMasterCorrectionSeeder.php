<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Services\Inventory\ProductMasterCorrectionService;
use Illuminate\Database\Seeder;

final class ProductMasterCorrectionSeeder extends Seeder
{
    public function run(): void
    {
        app(
            ProductMasterCorrectionService::class
        )->applyForTenantSlug('vitapharma');
    }
}
