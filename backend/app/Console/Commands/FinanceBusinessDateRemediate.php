<?php

namespace App\Console\Commands;

use App\Models\PharmacoPayment;
use App\Models\PharmacoSale;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Console\Command;

class FinanceBusinessDateRemediate extends Command
{
    protected $signature = 'finance:business-date:remediate
        {--tenant_id= : Restrict to one tenant}
        {--limit=0 : Maximum rows per record group}
        {--apply : Apply the proposed Business Dates}';

    protected $description =
        'Remediate missing Finance Business Dates; dry-run by default.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $tenantId = $this->option('tenant_id');
        $limit = max(
            0,
            (int) $this->option('limit')
        );

        $this->info(
            'Finance Business Date Remediation'
        );
        $this->line(
            'Mode: ' . ($apply ? 'apply' : 'dry-run')
        );

        $results = [
            'sales' => $this->processSales(
                $tenantId,
                $limit,
                $apply,
            ),
            'payments' => $this->processPayments(
                $tenantId,
                $limit,
                $apply,
            ),
            'stock_movements' =>
                $this->processMovements(
                    $tenantId,
                    $limit,
                    $apply,
                ),
        ];

        foreach ($results as $group => $result) {
            $this->line(
                "{$group}: candidates={$result['candidates']} "
                . "resolved={$result['resolved']} "
                . "unresolved={$result['unresolved']} "
                . "applied={$result['applied']}"
            );
        }

        $this->line(
            'Production writes: '
            . ($apply ? 'YES' : 'NO')
        );

        return self::SUCCESS;
    }

    /**
     * @return array<string, int>
     */
    private function processSales(
        mixed $tenantId,
        int $limit,
        bool $apply,
    ): array {
        $query = PharmacoSale::query()
            ->whereNull('business_date')
            ->orderBy('id');

        if (is_numeric($tenantId)) {
            $query->where(
                'tenant_id',
                (int) $tenantId
            );
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        $records = $query->get();

        $result = $this->emptyResult(
            $records->count()
        );

        foreach ($records as $sale) {
            $date = $this->dateFrom(
                $sale->sold_at
                ?: $sale->created_at
            );

            $source = $sale->sold_at
                ? 'pharmaco_sales.sold_at'
                : 'pharmaco_sales.created_at';

            $this->resolveRecord(
                $sale,
                $date,
                $source,
                $apply,
                $result,
            );
        }

        return $result;
    }

    /**
     * @return array<string, int>
     */
    private function processPayments(
        mixed $tenantId,
        int $limit,
        bool $apply,
    ): array {
        $query = PharmacoPayment::query()
            ->with('sale')
            ->whereNull('business_date')
            ->orderBy('id');

        if (is_numeric($tenantId)) {
            $query->where(
                'tenant_id',
                (int) $tenantId
            );
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        $records = $query->get();

        $result = $this->emptyResult(
            $records->count()
        );

        foreach ($records as $payment) {
            if ($payment->sale?->business_date) {
                $date =
                    $payment->sale->business_date
                        ->toDateString();

                $source =
                    'pharmaco_sales.business_date';
            } elseif ($payment->received_at) {
                $date =
                    $payment->received_at
                        ->toDateString();

                $source =
                    'pharmaco_payments.received_at';
            } else {
                $date = $this->dateFrom(
                    $payment->created_at
                );

                $source =
                    'pharmaco_payments.created_at';
            }

            $this->resolveRecord(
                $payment,
                $date,
                $source,
                $apply,
                $result,
            );
        }

        return $result;
    }

    /**
     * @return array<string, int>
     */
    private function processMovements(
        mixed $tenantId,
        int $limit,
        bool $apply,
    ): array {
        $query = StockMovement::query()
            ->with('posSession')
            ->whereNull('business_date')
            ->orderBy('id');

        if (is_numeric($tenantId)) {
            $query->where(
                'tenant_id',
                (int) $tenantId
            );
        }

        if ($limit > 0) {
            $query->limit($limit);
        }

        $records = $query->get();

        $result = $this->emptyResult(
            $records->count()
        );

        foreach ($records as $movement) {
            if ($movement->posSession?->business_date) {
                $date =
                    $movement->posSession
                        ->business_date
                        ->toDateString();

                $source =
                    'pharmaco_pos_sessions.business_date';
            } elseif ($movement->occurred_at) {
                $date =
                    $movement->occurred_at
                        ->toDateString();

                $source =
                    'stock_movements.occurred_at';
            } else {
                $date = $this->dateFrom(
                    $movement->created_at
                );

                $source =
                    'stock_movements.created_at';
            }

            $this->resolveRecord(
                $movement,
                $date,
                $source,
                $apply,
                $result,
            );
        }

        return $result;
    }

    /**
     * @param array<string, int> $result
     */
    private function resolveRecord(
        mixed $record,
        ?string $date,
        string $source,
        bool $apply,
        array &$result,
    ): void {
        if (! $date) {
            $result['unresolved']++;

            $this->warn(
                "UNRESOLVED "
                . class_basename($record)
                . " id={$record->id}"
            );

            return;
        }

        $result['resolved']++;

        $this->line(
            "RESOLVED "
            . class_basename($record)
            . " id={$record->id} "
            . "business_date={$date} "
            . "source={$source}"
        );

        if (! $apply) {
            return;
        }

        $metadata = (array) $record->metadata;

        $metadata['finance_business_date_remediation'] = [
            'derived_business_date' => $date,
            'derivation_source' => $source,
            'applied_at' => now()->toISOString(),
            'command' => self::class,
        ];

        $record->forceFill([
            'business_date' => $date,
            'metadata' => $metadata,
        ])->save();

        $result['applied']++;
    }

    private function dateFrom(
        mixed $value,
    ): ?string {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)
            ->toDateString();
    }

    /**
     * @return array<string, int>
     */
    private function emptyResult(
        int $candidates,
    ): array {
        return [
            'candidates' => $candidates,
            'resolved' => 0,
            'unresolved' => 0,
            'applied' => 0,
        ];
    }
}
