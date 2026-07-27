<?php

declare(strict_types=1);

namespace App\Exceptions\Finance;

use RuntimeException;

final class FinancePaymentPostingBlockedException extends RuntimeException
{
    public function __construct(
        public readonly string $decision,
        public readonly ?int $policyId,
        string $message
    ) {
        parent::__construct($message);
    }
}
