<?php

namespace App\Models\Hrm;

class Position extends HrmModel
{
    protected $table = 'hrm_positions';

    protected $casts = [
        'headcount_budget' => 'integer',
        'requires_professional_license' => 'boolean',
    ];

    public function grade()
    {
        return $this->belongsTo(
            JobGrade::class,
            'job_grade_id'
        );
    }
}
