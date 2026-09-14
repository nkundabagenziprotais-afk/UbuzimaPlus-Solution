<?php

namespace App\Models\Hrm;

class EmployeeAssignment extends HrmModel
{
    protected $table = 'hrm_employee_assignments';

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'approved_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
