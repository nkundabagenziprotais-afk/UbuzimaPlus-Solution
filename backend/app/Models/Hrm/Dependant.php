<?php

namespace App\Models\Hrm;

class Dependant extends HrmModel
{
    protected $table = 'hrm_employee_dependants';

    protected $hidden = [
        'encrypted_payload',
    ];

    protected $casts = [
        'encrypted_payload' => 'encrypted:array',
        'eligible_for_benefits' => 'boolean',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
