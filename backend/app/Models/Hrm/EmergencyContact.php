<?php

namespace App\Models\Hrm;

class EmergencyContact extends HrmModel
{
    protected $table = 'hrm_employee_emergency_contacts';

    protected $hidden = [
        'encrypted_payload',
    ];

    protected $casts = [
        'encrypted_payload' => 'encrypted:array',
        'is_primary' => 'boolean',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
