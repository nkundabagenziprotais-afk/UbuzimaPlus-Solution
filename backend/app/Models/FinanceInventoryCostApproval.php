<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

class FinanceInventoryCostApproval extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'branch_id',
        'stock_batch_id',
        'effective_date',
        'approved_unit_cost',
        'currency_code',
        'approval_method',
        'valuation_basis',
        'source_reference',
        'source_document_date',
        'approval_notes',
        'approved_by',
        'approved_at',
        'status',
        'approval_key',
        'source_file_sha256',
        'batch_snapshot',
        'approval_evidence',
        'metadata',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'approved_unit_cost' => 'decimal:4',
        'source_document_date' => 'date',
        'approved_at' => 'datetime',
        'batch_snapshot' => 'array',
        'approval_evidence' => 'array',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(
            function (): void {
                throw new LogicException(
                    'Finance inventory cost approvals are immutable.'
                );
            }
        );

        static::deleting(
            function (): void {
                throw new LogicException(
                    'Finance inventory cost approvals cannot be deleted.'
                );
            }
        );
    }
}
