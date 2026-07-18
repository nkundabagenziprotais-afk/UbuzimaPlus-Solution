<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsurancePartnerDocument extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_partner_id',
        'document_type',
        'title',
        'file_path',
        'original_filename',
        'mime_type',
        'file_size',
        'version',
        'effective_from',
        'effective_to',
        'status',
        'is_primary',
        'notes',
        'metadata',
        'uploaded_by',
        'uploaded_at',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_primary' => 'boolean',
        'metadata' => 'array',
        'uploaded_at' => 'datetime',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
