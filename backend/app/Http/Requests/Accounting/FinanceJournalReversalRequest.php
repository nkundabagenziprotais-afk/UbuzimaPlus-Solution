<?php

namespace App\Http\Requests\Accounting;

use Illuminate\Foundation\Http\FormRequest;

class FinanceJournalReversalRequest extends FormRequest
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
            'journal_entry_id' => ['prohibited'],
            'created_by' => ['prohibited'],
            'approved_by' => ['prohibited'],

            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],

            'reason' => [
                'required',
                'string',
                'min:3',
                'max:1000',
            ],
        ];
    }
}
