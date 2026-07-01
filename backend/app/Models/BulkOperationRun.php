<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BulkOperationRun extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'tenant_id',
        'operation_type',
        'target_table',
        'status',
        'total_rows',
        'processed_rows',
        'failed_rows',
        'summary',
    ];

    protected $casts = [
        'summary' => 'array',
    ];
}
