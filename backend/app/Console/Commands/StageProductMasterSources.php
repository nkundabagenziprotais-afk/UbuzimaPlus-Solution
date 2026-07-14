<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\Inventory\ProductSourceImportService;
use Illuminate\Console\Command;
use JsonException;
use Throwable;

class StageProductMasterSources extends Command
{
    protected $signature = 'product-master:stage-sources
        {--tenant=vitapharma : Tenant slug}
        {--drugs= : Absolute path to DRUGS.xlsx}
        {--medicines= : Absolute path to Medicines.xlsx}
        {--reconciliation= : Absolute path to the reconciliation workbook}
        {--eden= : Optional absolute path to the Eden Care PDF}
        {--json-output= : Optional JSON result filename}';

    protected $description = 'Stage Product Master source catalogues for controlled administrator review.';

    public function handle(ProductSourceImportService $service): int
    {
        $tenantSlug = trim((string) $this->option('tenant'));

        $tenant = Tenant::query()
            ->where('slug', $tenantSlug)
            ->first();

        if (! $tenant) {
            $this->error("Tenant not found: {$tenantSlug}");

            return self::FAILURE;
        }

        $sources = [
            'drugs' => $this->requiredPath('drugs'),
            'medicines' => $this->requiredPath('medicines'),
            'reconciliation' => $this->requiredPath('reconciliation'),
            'eden' => $this->optionalPath('eden'),
        ];

        if (
            ! $sources['drugs']
            || ! $sources['medicines']
            || ! $sources['reconciliation']
        ) {
            return self::FAILURE;
        }

        try {
            $result = $service->stageSources(
                (int) $tenant->id,
                null,
                $sources
            );

            $json = json_encode(
                $result,
                JSON_PRETTY_PRINT
                | JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
                | JSON_THROW_ON_ERROR
            );
        } catch (JsonException|Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $outputFile = trim(
            (string) $this->option('json-output')
        );

        if ($outputFile !== '') {
            $directory = dirname($outputFile);

            if (! is_dir($directory)) {
                mkdir($directory, 0700, true);
            }

            file_put_contents(
                $outputFile,
                $json.PHP_EOL
            );
        }

        $this->line($json);
        $this->newLine();
        $this->info('Product Master sources were staged for review.');

        return self::SUCCESS;
    }

    private function requiredPath(string $option): ?string
    {
        $path = trim((string) $this->option($option));

        if ($path === '' || ! is_file($path)) {
            $this->error("Required source file is missing: --{$option}");

            return null;
        }

        return $path;
    }

    private function optionalPath(string $option): ?string
    {
        $path = trim((string) $this->option($option));

        if ($path === '') {
            return null;
        }

        if (! is_file($path)) {
            $this->warn("Optional source file is unavailable: {$path}");

            return null;
        }

        return $path;
    }
}
