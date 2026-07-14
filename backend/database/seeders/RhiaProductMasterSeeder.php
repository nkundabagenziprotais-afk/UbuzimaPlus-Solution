<?php

namespace Database\Seeders;



use App\Services\Inventory\ProductMasterCorrectionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class RhiaProductMasterSeeder extends Seeder
{
    public function run(): void
    {
        $tenantSlug = env('UBUZIMA_RHIA_IMPORT_TENANT', 'vitapharma');

        $tenant = DB::table('tenants')->where('slug', $tenantSlug)->first();

        if (! $tenant) {
            $this->command?->warn("Tenant {$tenantSlug} was not found. RHIA Product Master import skipped.");
            return;
        }

        $csvPath = database_path('seeders/data/rhia_reimbursable_medicines_june_2026.csv');

        if (! file_exists($csvPath)) {
            $this->command?->error("Missing RHIA CSV file: {$csvPath}");
            return;
        }

        if (env('UBUZIMA_PURGE_PRODUCT_MASTER_BEFORE_RHIA', false)) {
            if (app()->environment('production')) {
                $this->command?->error('RHIA purge is blocked in production. Import without purge or run an approved migration plan.');
                return;
            }

            $productIds = DB::table('products')
                ->where('tenant_id', $tenant->id)
                ->pluck('id')
                ->all();

            if (! empty($productIds)) {
                $tables = collect(DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
                    ->pluck('name')
                    ->all();

                foreach ($tables as $table) {
                    if ($table === 'products' || ! Schema::hasColumn($table, 'product_id')) {
                        continue;
                    }

                    DB::table($table)->whereIn('product_id', $productIds)->delete();
                }

                if (Schema::hasTable('stock_batches')) {
                    $batchIds = DB::table('stock_batches')
                        ->whereIn('product_id', $productIds)
                        ->pluck('id')
                        ->all();

                    foreach ($tables as $table) {
                        if (! empty($batchIds) && Schema::hasColumn($table, 'stock_batch_id')) {
                            DB::table($table)->whereIn('stock_batch_id', $batchIds)->delete();
                        }
                    }

                    DB::table('stock_batches')->whereIn('product_id', $productIds)->delete();
                }

                foreach ($tables as $table) {
                    if ($table === 'products') {
                        continue;
                    }

                    $foreignKeys = DB::select("PRAGMA foreign_key_list('{$table}')");

                    foreach ($foreignKeys as $foreignKey) {
                        if (($foreignKey->table ?? null) === 'products' && ($foreignKey->from ?? null)) {
                            DB::table($table)->whereIn($foreignKey->from, $productIds)->delete();
                        }
                    }
                }

                DB::table('products')->whereIn('id', $productIds)->delete();
            }

            $this->command?->warn('Existing local tenant product and dependent sample inventory records were cleared because UBUZIMA_PURGE_PRODUCT_MASTER_BEFORE_RHIA=true.');
        }

        $handle = fopen($csvPath, 'r');

        if (! $handle) {
            $this->command?->error('Unable to open RHIA CSV file.');
            return;
        }

        $headers = fgetcsv($handle);
        $count = 0;

        DB::transaction(function () use ($handle, $headers, $tenant, &$count) {
            while (($row = fgetcsv($handle)) !== false) {
                $record = array_combine($headers, $row);

                if (! $record || empty($record['drug_code'])) {
                    continue;
                }

                $categoryId = $this->categoryId(
                    tenantId: (int) $tenant->id,
                    section: $record['section'] ?: 'RHIA Medicines'
                );

                $metadata = [
                    'source' => 'RHIA REIMBURSABLE MEDICINES LIST JUNE 2026',
                    'source_type' => 'insurance_reimbursement_master',
                    'rhia_sn' => (int) $record['sn'],
                    'rhia_drug_code' => $record['drug_code'],
                    'rhia_instructions' => $record['instructions'] ?: null,
                    'rhia_selling_unit' => $record['selling_unit'] ?: null,
                    'rhia_reimbursement_price' => (float) $record['price'],
                    'rhia_section' => $record['section'] ?: null,
                    'rhia_subsection' => $record['subsection'] ?: null,
                    'default_margin_percent' => 0,
                    'pricing_source' => 'product_master',
                    'reimbursement_status' => 'approved_by_rhia',
                    'requires_user_margin_review' => true,
                ];

                $payload = [
                    'tenant_id' => $tenant->id,
                    'product_category_id' => $categoryId,
                    'name' => $record['designation'] ?: $record['generic_description'],
                    'generic_name' => ProductMasterCorrectionService::correctedGenericName(
                        (string) $record['drug_code'],
                        $record['generic_description'] ?: null
                    ),
                    'brand_name' => $record['designation'] ?: null,
                    'sku' => $record['drug_code'],
                    'dosage_form' => $record['selling_unit'] ?: null,
                    'unit' => $record['selling_unit'] ?: 'unit',
                    'product_type' => 'medicine',
                    'regulatory_status' => 'approved',
                    'requires_prescription' => ! empty($record['instructions']),
                    'is_controlled' => false,
                    'reorder_level' => 0,
                    'minimum_stock_level' => 0,
                    'status' => 'active',
                    'metadata' => json_encode($metadata),
                    'updated_at' => now(),
                ];

                if (Schema::hasColumn('products', 'uuid')) {
                    $payload['uuid'] = (string) Str::uuid();
                }

                if (Schema::hasColumn('products', 'maximum_stock_level')) {
                    $payload['maximum_stock_level'] = null;
                }

                if (Schema::hasColumn('products', 'created_at')) {
                    $payload['created_at'] = now();
                }

                $existing = DB::table('products')
                    ->where('tenant_id', $tenant->id)
                    ->where('sku', $record['drug_code'])
                    ->first();

                if ($existing) {
                    unset($payload['uuid'], $payload['created_at']);

                    DB::table('products')
                        ->where('id', $existing->id)
                        ->update($payload);
                } else {
                    DB::table('products')->insert($payload);
                }

                $count++;
            }
        });

        fclose($handle);

        $this->command?->info("RHIA Product Master import completed: {$count} products processed.");
    }

    private function categoryId(int $tenantId, string $section): int
    {
        $code = Str::slug(Str::limit($section, 60, ''));

        $existing = DB::table('product_categories')
            ->where('tenant_id', $tenantId)
            ->where('code', $code)
            ->first();

        if ($existing) {
            return (int) $existing->id;
        }

        return (int) DB::table('product_categories')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => Schema::hasColumn('product_categories', 'uuid') ? (string) Str::uuid() : null,
            'name' => $section,
            'code' => $code,
            'category_type' => 'medicine',
            'status' => 'active',
            'description' => 'Imported from RHIA reimbursable medicines list June 2026.',
            'metadata' => json_encode([
                'source' => 'RHIA REIMBURSABLE MEDICINES LIST JUNE 2026',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
