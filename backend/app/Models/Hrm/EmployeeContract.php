<?php

namespace App\Models\Hrm;

class EmployeeContract extends HrmModel
{
    protected $table = 'hrm_employee_contracts';

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'probation_end_date' => 'date',
        'working_hours_per_week' => 'decimal:2',
        'signed_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
