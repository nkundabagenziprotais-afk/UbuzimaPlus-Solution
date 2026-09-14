<?php

namespace App\Models\Hrm;

class ProfessionalCredential extends HrmModel
{
    protected $table = 'hrm_professional_credentials';

    protected $hidden = [
        'encrypted_reference',
    ];

    protected $casts = [
        'encrypted_reference' => 'encrypted',
        'issued_at' => 'date',
        'expires_at' => 'date',
        'verified' => 'boolean',
        'verified_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
