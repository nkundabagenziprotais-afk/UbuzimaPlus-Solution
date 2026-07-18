<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InsuranceClaimSubmissionEvent extends Model
{
    protected $fillable = [
        'uuid',
        'tenant_id',
        'insurance_claim_id',
        'insurance_partner_id',
        'event_type',
        'submission_channel',
        'submission_status',
        'recipient_name',
        'recipient_email',
        'recipient_phone',
        'submission_reference',
        'document_path',
        'annex_document_path',
        'message_body',
        'notes',
        'metadata',
        'submitted_by',
        'submitted_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'submitted_at' => 'datetime',
    ];

    public function claim(): BelongsTo
    {
        return $this->belongsTo(InsuranceClaim::class, 'insurance_claim_id');
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(InsurancePartner::class, 'insurance_partner_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
