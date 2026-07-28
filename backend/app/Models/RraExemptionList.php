<?php

namespace App\Models;

use App\Models\Concerns\GeneratesUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RraExemptionList extends Model
{
    use GeneratesUuid;

    protected $fillable = [
        'uuid',
        'code',
        'title',
        'list_type',
        'issuing_authority',
        'approving_authority',
        'publishing_authority',
        'version_label',
        'publication_date',
        'effective_from',
        'effective_to',
        'source_url',
        'source_sha256',
        'source_format',
        'import_status',
        'record_count',
        'imported_by',
        'approved_by',
        'imported_at',
        'approved_at',
        'status',
        'metadata',
    ];

    protected $casts = [
        'publication_date' => 'date',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'imported_at' => 'datetime',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];


    public function items(): HasMany
    {
        return $this->hasMany(RraExemptionItem::class);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

}
