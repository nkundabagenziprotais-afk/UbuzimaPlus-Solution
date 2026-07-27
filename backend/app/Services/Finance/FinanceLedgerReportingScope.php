<?php

namespace App\Services\Finance;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Schema;

class FinanceLedgerReportingScope
{
    public const AUTHORITATIVE_SCOPE =
        'authoritative_reporting';

    public const ACTIVE_STATUS =
        'active';

    public function applyAuthoritative(
        Builder $query,
        ?int $tenantId = null,
        string $entriesAlias = 'finance_journal_entries',
        ?string $asOfDate = null,
    ): Builder {
        $query->where(
            "{$entriesAlias}.status",
            'posted'
        );

        if ($tenantId !== null) {
            $query->where(
                "{$entriesAlias}.tenant_id",
                $tenantId
            );
        }

        if (
            ! Schema::hasTable(
                'finance_reporting_exclusions'
            )
        ) {
            return $query;
        }

        $asOfDate ??=
            now()->toDateString();

        return $query->whereNotExists(
            function (
                Builder $subquery
            ) use (
                $entriesAlias,
                $asOfDate,
            ): void {
                $subquery
                    ->selectRaw('1')
                    ->from(
                        'finance_reporting_exclusions as exclusions'
                    )
                    ->whereColumn(
                        'exclusions.tenant_id',
                        "{$entriesAlias}.tenant_id"
                    )
                    ->whereColumn(
                        'exclusions.finance_journal_entry_id',
                        "{$entriesAlias}.id"
                    )
                    ->where(
                        'exclusions.scope',
                        self::AUTHORITATIVE_SCOPE
                    )
                    ->where(
                        'exclusions.status',
                        self::ACTIVE_STATUS
                    )
                    ->whereDate(
                        'exclusions.effective_from',
                        '<=',
                        $asOfDate
                    );
            }
        );
    }

    public function applyShadowDiagnostic(
        Builder $query,
        ?int $tenantId = null,
        string $entriesAlias = 'finance_journal_entries',
    ): Builder {
        $query->where(
            "{$entriesAlias}.status",
            'shadow_posted'
        );

        if ($tenantId !== null) {
            $query->where(
                "{$entriesAlias}.tenant_id",
                $tenantId
            );
        }

        return $query;
    }
}
