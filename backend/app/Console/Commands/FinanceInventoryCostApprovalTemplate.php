<?php

namespace App\Console\Commands;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FinanceInventoryCostApprovalTemplate extends Command
{
    protected $signature =
        'finance:inventory-cost-approvals:template
        {--tenant_id=1 : Tenant ID}
        {--cutover_date=2026-08-01 : Approved prospective cutover date}
        {--output= : CSV output path}';

    protected $description =
        'Generate an opening-valuation approval template without database writes.';

    public function handle(): int
    {
        $tenantId = (int) $this->option(
            'tenant_id'
        );

        if ($tenantId <= 0) {
            $this->error(
                'Tenant ID must be positive.'
            );

            return self::FAILURE;
        }

        try {
            $cutoverDate =
                CarbonImmutable::parse(
                    (string) $this->option(
                        'cutover_date'
                    )
                )->toDateString();
        } catch (\Throwable) {
            $this->error(
                'Cutover date is invalid.'
            );

            return self::FAILURE;
        }

        $output = trim(
            (string) $this->option('output')
        );

        if ($output === '') {
            $output = storage_path(
                'app/finance/'
                . "inventory-cost-approval-{$tenantId}-{$cutoverDate}.csv"
            );
        }

        $directory = dirname($output);

        if (
            ! is_dir($directory)
            && ! mkdir(
                $directory,
                0770,
                true
            )
            && ! is_dir($directory)
        ) {
            $this->error(
                'Unable to create the template directory.'
            );

            return self::FAILURE;
        }

        $batches = DB::table(
            'stock_batches as batch'
        )
            ->leftJoin(
                'products as product',
                'product.id',
                '=',
                'batch.product_id'
            )
            ->where(
                'batch.tenant_id',
                $tenantId
            )
            ->whereRaw(
                'ABS(COALESCE(batch.quantity_on_hand, 0)) > 0.0001'
            )
            ->whereRaw(
                'NOT (
                    COALESCE(batch.unit_cost, 0) > 0
                    OR COALESCE(batch.original_unit_cost, 0) > 0
                    OR (
                        COALESCE(batch.inferred_unit_cost, 0) > 0
                        AND batch.cost_resolved_at IS NOT NULL
                        AND TRIM(COALESCE(batch.cost_source, \'\')) <> \'\'
                    )
                )'
            )
            ->select([
                'batch.id',
                'batch.tenant_id',
                'batch.product_id',
                'product.name as product_name',
                'product.sku as product_sku',
                'batch.batch_number',
                'batch.quantity_on_hand',
                'batch.quantity_reserved',
                'batch.selling_price',
                'batch.supplier_name',
                'batch.received_at',
                'batch.updated_at',
            ])
            ->orderBy('batch.id')
            ->get();

        $handle = fopen(
            $output,
            'wb'
        );

        if (! is_resource($handle)) {
            $this->error(
                'Unable to create the approval template.'
            );

            return self::FAILURE;
        }

        $write = static function (
            $handle,
            array $row,
        ): void {
            fputcsv(
                $handle,
                $row,
                ',',
                '"',
                ''
            );
        };

        $headers = [
            'tenant_id',
            'stock_batch_id',
            'product_id',
            'product_name',
            'product_sku',
            'batch_number',
            'expected_quantity_on_hand',
            'expected_quantity_reserved',
            'expected_batch_updated_at',
            'expected_selling_price',
            'derivation_divisor',
            'derivation_formula',
            'decision',
            'approved_unit_cost',
            'currency_code',
            'approval_method',
            'effective_date',
            'valuation_basis',
            'source_reference',
            'source_document_date',
            'approved_by_user_id',
            'approval_notes',
            'evidence_reviewed',
            'selling_price_used',
        ];

        $write(
            $handle,
            $headers
        );

        foreach ($batches as $batch) {
            $write(
                $handle,
                [
                    $batch->tenant_id,
                    $batch->id,
                    $batch->product_id,
                    $batch->product_name,
                    $batch->product_sku,
                    $batch->batch_number,
                    $batch->quantity_on_hand,
                    $batch->quantity_reserved,
                    $batch->updated_at,
                    $batch->selling_price,
                    '',
                    '',
                    'hold',
                    '',
                    'RWF',
                    '',
                    $cutoverDate,
                    '',
                    '',
                    '',
                    '',
                    '',
                    'no',
                    'no',
                ]
            );
        }

        fclose($handle);

        $hash = hash_file(
            'sha256',
            $output
        );

        $this->info(
            'Finance Inventory Cost Approval Template'
        );

        $this->line(
            "Tenant: {$tenantId}"
        );

        $this->line(
            "Cutover date: {$cutoverDate}"
        );

        $this->line(
            'Active unresolved batches: '
            . $batches->count()
        );

        $this->line(
            "Template: {$output}"
        );

        $this->line(
            "SHA-256: {$hash}"
        );

        $this->line(
            'Database writes: NO'
        );

        return self::SUCCESS;
    }
}
