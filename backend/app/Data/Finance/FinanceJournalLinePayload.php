<?php

namespace App\Data\Finance;

class FinanceJournalLinePayload
{
    public function __construct(
        public readonly string $mappingKey,
        public readonly float|string $debit = 0,
        public readonly float|string $credit = 0,
        public readonly ?string $description = null,
        public readonly ?string $lineType = null,
        public readonly ?int $branchId = null,
        public readonly ?int $departmentId = null,
        public readonly ?int $customerId = null,
        public readonly ?int $supplierId = null,
        public readonly ?int $productId = null,
        public readonly ?int $stockLocationId = null,
        public readonly ?int $insurancePartnerId = null,
        public readonly ?string $paymentMethod = null,
        public readonly array $metadata = [],
    ) {
    }
}
