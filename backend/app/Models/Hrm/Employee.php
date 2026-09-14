<?php

namespace App\Models\Hrm;

class Employee extends HrmModel
{
    protected $table = 'hrm_employees';

    protected $hidden = [
        'private_profile',
    ];

    protected $casts = [
        'hire_date' => 'date',
        'termination_date' => 'date',
        'probation_end_date' => 'date',
        'private_profile' => 'encrypted:array',
        'metadata' => 'array',
    ];

    public function position()
    {
        return $this->belongsTo(
            Position::class,
            'current_position_id'
        );
    }

    public function grade()
    {
        return $this->belongsTo(
            JobGrade::class,
            'job_grade_id'
        );
    }

    public function assignments()
    {
        return $this->hasMany(
            EmployeeAssignment::class,
            'employee_id'
        );
    }

    public function contracts()
    {
        return $this->hasMany(
            EmployeeContract::class,
            'employee_id'
        );
    }

    public function compensationHistory()
    {
        return $this->hasMany(
            CompensationHistory::class,
            'employee_id'
        );
    }
}
