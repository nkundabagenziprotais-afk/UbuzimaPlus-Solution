<?php

namespace App\Models\Hrm;

class CompensationHistory extends HrmModel
{
    protected $table = 'hrm_compensation_histories';

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
        'basic_salary' => 'decimal:2',
        'fixed_gross_compensation' => 'decimal:2',
        'approved_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }

    public function contract()
    {
        return $this->belongsTo(
            EmployeeContract::class,
            'contract_id'
        );
    }
}
