<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

final class FinancePaymentPostingPolicy extends Model
{
    protected $table =
        'finance_payment_posting_policies';

    protected $fillable = [
        'tenant_id',
        'policy_code',
        'source_type',
        'source_id',
        'policy_action',
        'status',
        'effective_date',
        'source_amount',
        'source_business_date',
        'source_state_hash',
        'reason',
        'evidence_reference',
        'evidence_hash',
        'approved_by_user_id',
        'approved_at',
        'metadata',
    ];

    protected $casts = [
        'tenant_id' => 'integer',
        'source_id' => 'integer',
        'effective_date' => 'date',
        'source_amount' => 'decimal:4',
        'source_business_date' => 'date',
        'approved_by_user_id' => 'integer',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(
            static function (): never {
                throw new LogicException(
                    'Finance payment-posting policies are immutable.'
                );
            }
        );

        static::deleting(
            static function (): never {
                throw new LogicException(
                    'Finance payment-posting policies cannot be deleted.'
                );
            }
        );
    }
}
