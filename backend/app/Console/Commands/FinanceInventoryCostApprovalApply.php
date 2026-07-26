<?php

namespace App\Console\Commands;

use App\Services\Finance\FinanceInventoryCostApprovalService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use SplFileObject;
use Throwable;

class FinanceInventoryCostApprovalApply extends Command
{
    protected $signature =
        'finance:inventory-cost-approvals:apply
        {file : Reviewed approval CSV}
        {--tenant_id=1 : Tenant ID}
        {--cutover_date=2026-08-01 : Approved prospective cutover date}
        {--confirm-sha256= : Required exact CSV hash when using --apply}
        {--apply : Apply approved rows; dry-run by default}';

    protected $description =
        'Validate and apply reviewed inventory cost approvals; dry-run by default.';

    /**
     * @var string[]
     */
    private array $requiredHeaders = [
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

    public function handle(
        FinanceInventoryCostApprovalService $service,
    ): int {
        $path = realpath(
            (string) $this->argument('file')
        );

        if (
            $path === false
            || ! is_file($path)
            || ! is_readable($path)
        ) {
            $this->error(
                'Approval CSV is missing or unreadable.'
            );

            return self::FAILURE;
        }

        $tenantId = (int) $this->option(
            'tenant_id'
        );

        if ($tenantId <= 0) {
            $this->error(
                'Tenant ID must be positive.'
            );

            return self::FAILURE;
        }

        $apply = (bool) $this->option(
            'apply'
        );

        $fileHash = hash_file(
            'sha256',
            $path
        );

        $this->info(
            'Finance Inventory Cost Approval Review'
        );

        $this->line(
            'Mode: ' . (
                $apply
                    ? 'apply'
                    : 'dry-run'
            )
        );

        $this->line(
            "File: {$path}"
        );

        $this->line(
            "SHA-256: {$fileHash}"
        );

        if ($apply) {
            $confirmedHash = strtolower(
                trim(
                    (string) $this->option(
                        'confirm-sha256'
                    )
                )
            );

            if (
                $confirmedHash === ''
                || ! hash_equals(
                    strtolower($fileHash),
                    $confirmedHash
                )
            ) {
                $this->error(
                    'Apply mode requires the exact reviewed CSV SHA-256 hash.'
                );

                return self::FAILURE;
            }
        }

        $file = new SplFileObject(
            $path,
            'rb'
        );

        $file->setFlags(
            SplFileObject::READ_CSV
            | SplFileObject::SKIP_EMPTY
        );

        $file->setCsvControl(
            ',',
            '"',
            ''
        );

        $headers = $file->fgetcsv();

        if (! is_array($headers)) {
            $this->error(
                'Approval CSV has no header row.'
            );

            return self::FAILURE;
        }

        $headers = array_map(
            static fn ($value): string =>
                trim((string) $value),
            $headers
        );

        if (isset($headers[0])) {
            $headers[0] = preg_replace(
                '/^\xEF\xBB\xBF/',
                '',
                $headers[0]
            );
        }

        if ($headers !== $this->requiredHeaders) {
            $this->error(
                'Approval CSV headers do not match the controlled template.'
            );

            return self::FAILURE;
        }

        $rows = [];
        $lineNumber = 1;

        while (! $file->eof()) {
            $lineNumber++;
            $values = $file->fgetcsv();

            if (
                ! is_array($values)
                || $values === [null]
            ) {
                continue;
            }

            if (
                count($values)
                !== count($headers)
            ) {
                $this->error(
                    "Line {$lineNumber} has an invalid column count."
                );

                return self::FAILURE;
            }

            $row = array_combine(
                $headers,
                $values
            );

            if (! is_array($row)) {
                $this->error(
                    "Line {$lineNumber} could not be parsed."
                );

                return self::FAILURE;
            }

            $row['_line_number'] =
                $lineNumber;

            $rows[] = $row;
        }

        if ($rows === []) {
            $this->error(
                'Approval CSV contains no data rows.'
            );

            return self::FAILURE;
        }

        $duplicateBatchIds = [];
        $seenBatchIds = [];

        foreach ($rows as $row) {
            $batchId = trim(
                (string) (
                    $row['stock_batch_id']
                    ?? ''
                )
            );

            if (isset($seenBatchIds[$batchId])) {
                $duplicateBatchIds[] =
                    $batchId;
            }

            $seenBatchIds[$batchId] = true;
        }

        if ($duplicateBatchIds !== []) {
            $this->error(
                'Duplicate stock batch IDs: '
                . implode(
                    ', ',
                    array_unique(
                        $duplicateBatchIds
                    )
                )
            );

            return self::FAILURE;
        }

        $validatedRows = [];
        $errors = [];

        foreach ($rows as $row) {
            try {
                $validatedRows[] =
                    $service->validateRow(
                        $row,
                        $fileHash,
                        $tenantId,
                        (string) $this->option(
                            'cutover_date'
                        ),
                    );
            } catch (Throwable $exception) {
                $errors[] =
                    'Line '
                    . $row['_line_number']
                    . ': '
                    . $exception->getMessage();
            }
        }

        foreach ($errors as $error) {
            $this->error($error);
        }

        if ($errors !== []) {
            $this->line(
                'Validated rows: '
                . count($validatedRows)
            );

            $this->line(
                'Validation errors: '
                . count($errors)
            );

            $this->line(
                'Database writes: NO'
            );

            return self::FAILURE;
        }

        $approvalRows = array_values(
            array_filter(
                $validatedRows,
                static fn (array $row): bool =>
                    $row['decision']
                    === 'approve'
            )
        );

        $heldRows = count($validatedRows)
            - count($approvalRows);

        $idempotentRows = count(
            array_filter(
                $approvalRows,
                static fn (array $row): bool =>
                    (bool) (
                        $row['idempotent']
                        ?? false
                    )
            )
        );

        $sellingPriceDerivedRows = count(
            array_filter(
                $approvalRows,
                static fn (array $row): bool =>
                    (bool) (
                        $row['selling_price_used']
                        ?? false
                    )
            )
        );

        $this->line(
            'Rows reviewed: '
            . count($validatedRows)
        );

        $this->line(
            'Rows approved: '
            . count($approvalRows)
        );

        $this->line(
            "Rows held: {$heldRows}"
        );

        $this->line(
            "Idempotent rows: {$idempotentRows}"
        );

        $this->line(
            "Selling-price-derived approvals: {$sellingPriceDerivedRows}"
        );

        $this->line(
            'Selling price used as cost: '
            . (
                $sellingPriceDerivedRows > 0
                    ? 'YES_CONTROLLED_OWNER_APPROVED'
                    : 'NO'
            )
        );

        if (! $apply) {
            $this->line(
                'Database writes: NO'
            );

            return self::SUCCESS;
        }

        $applied = 0;

        DB::transaction(
            function () use (
                $approvalRows,
                $service,
                &$applied,
            ): void {
                foreach ($approvalRows as $row) {
                    $service->applyValidated(
                        $row
                    );

                    if (
                        ! (
                            $row['idempotent']
                            ?? false
                        )
                    ) {
                        $applied++;
                    }
                }
            }
        );

        $this->line(
            "New approvals applied: {$applied}"
        );

        $this->line(
            "Held rows unchanged: {$heldRows}"
        );

        $this->line(
            'Database writes: YES'
        );

        return self::SUCCESS;
    }
}
