<?php

namespace App\Console\Commands;

use App\Models\FinanceAccountingPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FinancePeriodPlan extends Command
{
    protected $signature = 'finance:periods:plan
        {--tenant_id=* : Tenant IDs to include}
        {--from= : First Business Date}
        {--to= : Last Business Date}
        {--apply : Create the planned periods}';

    protected $description =
        'Plan monthly Finance accounting periods; dry-run by default.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');

        $tenantIds = collect(
            (array) $this->option('tenant_id')
        )
            ->filter(
                fn ($value): bool =>
                    is_numeric($value)
            )
            ->map(
                fn ($value): int =>
                    (int) $value
            )
            ->values();

        if ($tenantIds->isEmpty()) {
            $tenantIds = DB::table(
                'finance_chart_of_accounts'
            )
                ->distinct()
                ->orderBy('tenant_id')
                ->pluck('tenant_id')
                ->map(
                    fn ($value): int =>
                        (int) $value
                );
        }

        if ($tenantIds->isEmpty()) {
            $this->error(
                'No Finance-enabled tenants were found.'
            );

            return self::FAILURE;
        }

        $minimumDate = collect([
            DB::table('pharmaco_sales')
                ->whereNotNull('business_date')
                ->min('business_date'),
            DB::table('pharmaco_payments')
                ->whereNotNull('business_date')
                ->min('business_date'),
            DB::table('stock_movements')
                ->whereNotNull('business_date')
                ->min('business_date'),
        ])
            ->filter()
            ->sort()
            ->first();

        $from = CarbonImmutable::parse(
            $this->option('from')
            ?: $minimumDate
            ?: now()->toDateString()
        )->startOfMonth();

        $to = CarbonImmutable::parse(
            $this->option('to')
            ?: now()->toDateString()
        )->endOfMonth();

        if ($from->greaterThan($to)) {
            $this->error(
                'The period-plan start date is after the end date.'
            );

            return self::FAILURE;
        }

        $this->info('Finance Accounting Period Plan');
        $this->line(
            'Mode: ' . ($apply ? 'apply' : 'dry-run')
        );
        $this->line(
            "Range: {$from->toDateString()} to {$to->toDateString()}"
        );

        $planned = 0;
        $created = 0;
        $existing = 0;

        foreach ($tenantIds as $tenantId) {
            $cursor = $from;

            while ($cursor->lessThanOrEqualTo($to)) {
                $startsOn = $cursor->startOfMonth();
                $endsOn = $cursor
                    ->endOfMonth()
                    ->min($to);

                $overlap = FinanceAccountingPeriod::query()
                    ->where('tenant_id', $tenantId)
                    ->whereNull('branch_id')
                    ->whereDate(
                        'starts_on',
                        '<=',
                        $endsOn->toDateString()
                    )
                    ->whereDate(
                        'ends_on',
                        '>=',
                        $startsOn->toDateString()
                    )
                    ->first();

                $planned++;

                if ($overlap) {
                    $existing++;

                    $this->line(
                        "EXISTS tenant={$tenantId} "
                        . "{$overlap->starts_on->toDateString()} "
                        . "to {$overlap->ends_on->toDateString()} "
                        . "status={$overlap->status}"
                    );
                } elseif ($apply) {
                    FinanceAccountingPeriod::query()->create([
                        'tenant_id' => $tenantId,
                        'branch_id' => null,
                        'name' => $startsOn->format('F Y'),
                        'starts_on' =>
                            $startsOn->toDateString(),
                        'ends_on' =>
                            $endsOn->toDateString(),
                        'status' => 'open',
                        'is_locked' => false,
                        'metadata' => [
                            'created_by_command' =>
                                self::class,
                            'creation_mode' =>
                                'controlled_period_plan',
                        ],
                    ]);

                    $created++;

                    $this->line(
                        "CREATED tenant={$tenantId} "
                        . "{$startsOn->toDateString()} "
                        . "to {$endsOn->toDateString()}"
                    );
                } else {
                    $this->line(
                        "PLANNED tenant={$tenantId} "
                        . "{$startsOn->toDateString()} "
                        . "to {$endsOn->toDateString()}"
                    );
                }

                $cursor = $cursor->addMonthNoOverflow();
            }
        }

        $this->newLine();
        $this->line("Planned: {$planned}");
        $this->line("Existing: {$existing}");
        $this->line("Created: {$created}");
        $this->line(
            'Production writes: '
            . ($apply ? 'YES' : 'NO')
        );

        return self::SUCCESS;
    }
}
