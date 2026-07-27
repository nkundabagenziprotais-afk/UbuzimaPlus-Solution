<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

final class FinancePaymentPostingPolicyAttempt extends Model
{
    protected $table =
        'finance_payment_posting_policy_attempts';

    public const UPDATED_AT = null;

    protected $fillable = [
        'tenant_id',
        'policy_id',
        'source_type',
        'source_id',
        'attempted_command',
        'decision',
        'reason',
        'attempted_by_user_id',
        'attempted_at',
        'request_correlation_id',
        'metadata',
    ];

    protected $casts = [
        'tenant_id' => 'integer',
        'policy_id' => 'integer',
        'source_id' => 'integer',
        'attempted_by_user_id' => 'integer',
        'attempted_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(
            static function (): never {
                throw new LogicException(
                    'Finance policy attempts are append-only.'
                );
            }
        );

        static::deleting(
            static function (): never {
                throw new LogicException(
                    'Finance policy attempts cannot be deleted.'
                );
            }
        );
    }
}
