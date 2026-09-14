<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| AQUILA_POS_MIDNIGHT_COMMAND_R578M_R1
|--------------------------------------------------------------------------
*/
\Illuminate\Support\Facades\Artisan::command(
    'pharmaco:pos-auto-close-expired {--dry-run}',
    function () {
        $dryRun =
            (bool)
            $this->option(
                'dry-run'
            );

        $result =
            app(
                \App\Services\PharmaCo360\PosSessionPolicyService::class
            )
            ->autoCloseExpiredLiveSessions(
                $dryRun
            );

        if (
            $dryRun
            ||
            (int) (
                $result[
                    'closed_count'
                ]
                ??
                0
            )
            >
            0
        ) {
            $this->line(
                json_encode(
                    $result,
                    JSON_PRETTY_PRINT
                    |
                    JSON_UNESCAPED_SLASHES
                )
            );
        }

        return 0;
    }
)->purpose(
    'Automatically close stale Live POS sessions after Kigali business-date rollover.'
);


/*
|--------------------------------------------------------------------------
| AQUILA_FINANCE_RECOGNITION_F1_R1_1
|--------------------------------------------------------------------------
|
| Historical POS accounting recognition classification.
|
| This command never changes finance_journal_entries.status.
|
*/

\Illuminate\Support\Facades\Artisan::command(
    'finance:recognition-scan
        {tenant=1 : Tenant ID}
        {--dry-run : Classify without persisting the governance registry}',
    function () {
        $tenantId = (int) $this->argument(
            'tenant'
        );

        $dryRun = (bool) $this->option(
            'dry-run'
        );

        $result = app(
            \App\Services\Finance\FinanceRecognitionClassifier::class
        )->scan(
            $tenantId,
            ! $dryRun
        );

        $this->line(
            'SCAN_VERSION='
            . $result['version']
        );

        $this->line(
            'TENANT_ID='
            . $result['tenant_id']
        );

        $this->line(
            'SCAN_MODE='
            . (
                $dryRun
                    ? 'DRY_RUN'
                    : 'PERSIST'
            )
        );

        $this->line(
            'SCAN_TOTAL='
            . $result['shadow_total']
        );

        $this->line(
            'RESOLVED_COUNT='
            . $result['resolved_count']
        );

        $this->line(
            'PENDING_COUNT='
            . $result['pending_count']
        );

        $this->line(
            'PAYMENT_AMOUNT_COLUMN='
            . (
                $result[
                    'payment_amount_column'
                ]
                ?? 'NONE'
            )
        );

        $this->line(
            'PAYMENT_CURRENCY_COLUMN='
            . (
                $result[
                    'payment_currency_column'
                ]
                ?? 'NONE'
            )
        );

        foreach (
            $result[
                'classification_counts'
            ]
            as $classification => $count
        ) {
            $this->line(
                'CLASSIFICATION|'
                . $classification
                . '|COUNT='
                . $count
            );
        }

        foreach (
            array_slice(
                array_values(
                    array_filter(
                        $result['items'],
                        static function (
                            array $item
                        ): bool {
                            return
                                $item[
                                    'resolution_status'
                                ]
                                !==
                                'resolved';
                        }
                    )
                ),
                0,
                20
            )
            as $item
        ) {
            $this->line(
                'REVIEW_ITEM'
                . '|journal_entry_id='
                . $item[
                    'journal_entry_id'
                ]
                . '|source_id='
                . (
                    $item[
                        'source_id'
                    ]
                    ?? ''
                )
                . '|classification='
                . $item[
                    'classification'
                ]
                . '|recommended_action='
                . $item[
                    'recommended_action'
                ]
            );
        }

        $this->line(
            'JOURNAL_STATUS_CHANGE=NO'
        );

        $this->line(
            'ACCOUNTING_AMOUNT_CHANGE=NO'
        );

        $this->line(
            'PAYMENT_CHANGE=NO'
        );

        $this->line(
            'INVENTORY_CHANGE=NO'
        );
    }
)->purpose(
    'Classify historical Finance shadow journals without changing accounting history.'
);

