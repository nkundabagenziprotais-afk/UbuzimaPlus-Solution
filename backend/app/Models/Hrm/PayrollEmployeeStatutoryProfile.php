<?php

namespace App\Models\Hrm;

class PayrollEmployeeStatutoryProfile extends HrmModel
{
    protected $table =
        'payroll_employee_statutory_profiles';

    protected $hidden = [
        'statutory_payload',
    ];

    protected $casts = [
        'statutory_payload' =>
            'encrypted:array',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
