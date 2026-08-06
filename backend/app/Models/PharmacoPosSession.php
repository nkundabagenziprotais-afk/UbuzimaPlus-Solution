<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PharmacoPosSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'user_id',
        'business_date',
        'session_mode',
        'terminal_identifier',
        'terminal_label',
        'historical_reason',
        'historical_reference',
        'historical_approval_id',
        'sequence_number',
        'session_number',
        'status',
        'opening_float_amount',
        'expected_cash_amount',
        'declared_cash_amount',
        'cash_drop_amount',
        'balance_clearance_amount',
        'variance_amount',
        'opened_at',
        'zeroized_at',
        'closed_at',
        'reset_authorized_at',
        'reset_authorized_by',
        'reset_reason',
        'metadata',
    ];

    protected $casts = [
        'business_date' => 'date',
        'sequence_number' => 'integer',
        'opening_float_amount' => 'decimal:2',
        'expected_cash_amount' => 'decimal:2',
        'declared_cash_amount' => 'decimal:2',
        'cash_drop_amount' => 'decimal:2',
        'balance_clearance_amount' => 'decimal:2',
        'variance_amount' => 'decimal:2',
        'opened_at' => 'datetime',
        'zeroized_at' => 'datetime',
        'closed_at' => 'datetime',
        'reset_authorized_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(
            function (
                self $session
            ): void {
                $wasClosed =
                    $session->getOriginal(
                        'status'
                    ) === 'closed'
                    || $session->getOriginal(
                        'closed_at'
                    ) !== null;

                if ($wasClosed) {
                    throw new \LogicException(
                        'Closed POS sessions are immutable.'
                    );
                }
            }
        );

        static::deleting(
            function (
                self $session
            ): void {
                if (
                    $session->status === 'closed'
                    || $session->closed_at !== null
                ) {
                    throw new \LogicException(
                        'Closed POS sessions cannot be deleted.'
                    );
                }
            }
        );
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resetAuthorizer(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'reset_authorized_by'
        );
    }

    public function historicalApproval(): BelongsTo
    {
        return $this->belongsTo(
            PharmacoHistoricalPosApproval::class,
            'historical_approval_id'
        );
    }

    public function sales(): HasMany
    {
        return $this->hasMany(
            PharmacoSale::class,
            'pos_session_id'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            PharmacoPayment::class,
            'pos_session_id'
        );
    }

    public function events(): HasMany
    {
        return $this->hasMany(
            PharmacoPosClockEvent::class,
            'pos_session_id'
        );
    }
}
