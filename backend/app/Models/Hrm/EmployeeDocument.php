<?php

namespace App\Models\Hrm;

class EmployeeDocument extends HrmModel
{
    protected $table = 'hrm_employee_documents';

    protected $casts = [
        'size_bytes' => 'integer',
        'issued_at' => 'date',
        'expires_at' => 'date',
    ];

    public function employee()
    {
        return $this->belongsTo(
            Employee::class,
            'employee_id'
        );
    }
}
