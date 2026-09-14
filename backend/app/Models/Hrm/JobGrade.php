<?php

namespace App\Models\Hrm;

class JobGrade extends HrmModel
{
    protected $table = 'hrm_job_grades';

    protected $casts = [
        'grade_level' => 'integer',
        'minimum_salary' => 'decimal:2',
        'maximum_salary' => 'decimal:2',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];
}
