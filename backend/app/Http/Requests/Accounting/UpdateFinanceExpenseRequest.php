<?php

namespace App\Http\Requests\Accounting;

class UpdateFinanceExpenseRequest
    extends StoreFinanceExpenseRequest
{
    public function rules(): array
    {
        $rules = parent::rules();

        unset(
            $rules['version']
        );

        $rules['expected_version'] = [
            'required',
            'integer',
            'min:1',
        ];

        return $rules;
    }
}
