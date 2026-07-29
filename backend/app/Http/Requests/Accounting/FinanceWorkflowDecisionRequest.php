<?php

namespace App\Http\Requests\Accounting;

use Illuminate\Foundation\Http\FormRequest;

class FinanceWorkflowDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'tenant_id' => ['prohibited'],
            'branch_id' => ['prohibited'],
            'requested_by' => ['prohibited'],
            'decided_by' => ['prohibited'],
            'status' => ['prohibited'],
            'version' => ['prohibited'],

            'comment' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }
}
