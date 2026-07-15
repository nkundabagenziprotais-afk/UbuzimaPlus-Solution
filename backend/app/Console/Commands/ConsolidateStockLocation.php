<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Inventory\StockLocationConsolidationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class ConsolidateStockLocation extends Command
{
    protected $signature =
        'inventory:consolidate-location
        {--source=HQ Main Store : Source stock location name}
        {--target=Vita Pharma Remera Store : Target stock location name}
        {--execute : Commit the consolidation instead of rolling it back}
        {--force : Confirm execution after an externally verified backup}';

    protected $description =
        'Safely consolidate stock batches and movement history between locations.';

    public function handle(
        StockLocationConsolidationService $service
    ): int {
        $execute = (bool) $this->option('execute');

        if ($execute) {
            $this->warn(
                'EXECUTION MODE: production data can be changed.'
            );

            if (
                ! (bool) $this->option('force')
                && ! $this->confirm(
                    'A verified database backup exists and this consolidation is approved?',
                    false
                )
            ) {
                $this->error(
                    'Consolidation cancelled before mutation.'
                );

                return self::FAILURE;
            }
        } else {
            $this->info(
                'DRY-RUN MODE: all database changes will be rolled back.'
            );
        }

        try {
            $report = $service->consolidate(
                (string) $this->option('source'),
                (string) $this->option('target'),
                $execute
            );
        } catch (Throwable $throwable) {
            Log::error(
                'Stock-location consolidation failed.',
                [
                    'source' =>
                        (string) $this->option('source'),
                    'target' =>
                        (string) $this->option('target'),
                    'execute' => $execute,
                    'exception' => $throwable,
                ]
            );

            $this->error($throwable->getMessage());

            return self::FAILURE;
        }

        $json = json_encode(
            $report,
            JSON_PRETTY_PRINT
            | JSON_UNESCAPED_SLASHES
            | JSON_THROW_ON_ERROR
        );

        $this->line($json);

        Log::notice(
            'Stock-location consolidation completed.',
            $report
        );

        return self::SUCCESS;
    }
}
