<?php

namespace App\Data\Finance;

class FinancePostingPayload
{
    /**
     * @param FinanceJournalLinePayload[] $lines
     */
    public function __construct(
        public readonly int $tenantId,
        public readonly ?int $branchId,
        public readonly ?string $businessDate,
        public readonly string $sourceModule,
        public readonly string $sourceType,
        public readonly string $sourceId,
        public readonly string $idempotencyKey,
        public readonly array $lines,
        public readonly string $currencyCode = 'RWF',
        public readonly float|string $exchangeRate = 1,
        public readonly ?string $memo = null,
        public readonly ?int $createdBy = null,
        public readonly array $sourceSnapshot = [],
        public readonly array $metadata = [],
        public readonly string $mode = 'live',
    ) {
    }
}
