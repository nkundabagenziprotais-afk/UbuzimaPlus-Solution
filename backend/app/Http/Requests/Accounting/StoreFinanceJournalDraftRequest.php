<?php

namespace App\Http\Requests\Accounting;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreFinanceJournalDraftRequest extends FormRequest
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
            'uuid' => ['prohibited'],
            'status' => ['prohibited'],
            'version' => ['prohibited'],
            'created_by' => ['prohibited'],
            'submitted_by' => ['prohibited'],
            'approved_by' => ['prohibited'],
            'posted_by' => ['prohibited'],
            'metadata' => ['prohibited'],

            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],

            'reference' => [
                'required',
                'string',
                'max:100',
            ],

            'description' => [
                'required',
                'string',
                'max:2000',
            ],

            'currency_code' => [
                'sometimes',
                'string',
                'in:RWF',
            ],

            'lines' => [
                'required',
                'array',
                'min:2',
                'max:100',
            ],

            'lines.*.finance_chart_of_account_id' => [
                'required',
                'integer',
                'min:1',
            ],

            'lines.*.description' => [
                'nullable',
                'string',
                'max:500',
            ],

            'lines.*.debit_amount' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'lines.*.credit_amount' => [
                'nullable',
                'numeric',
                'min:0',
            ],
        ];
    }

    public function withValidator(
        Validator $validator
    ): void {
        $validator->after(
            function (Validator $validator): void {
                $lines = $this->input('lines', []);

                if (! is_array($lines)) {
                    return;
                }

                $debits = 0.0;
                $credits = 0.0;

                foreach (
                    array_values($lines)
                    as $index => $line
                ) {
                    if (! is_array($line)) {
                        continue;
                    }

                    $debit = round(
                        (float) ($line['debit_amount'] ?? 0),
                        4
                    );

                    $credit = round(
                        (float) ($line['credit_amount'] ?? 0),
                        4
                    );

                    if ($debit <= 0 && $credit <= 0) {
                        $validator->errors()->add(
                            "lines.$index",
                            'A journal line must contain '
                            . 'a debit or credit amount.'
                        );
                    }

                    if ($debit > 0 && $credit > 0) {
                        $validator->errors()->add(
                            "lines.$index",
                            'A journal line cannot contain '
                            . 'both debit and credit.'
                        );
                    }

                    $debits += $debit;
                    $credits += $credit;
                }

                $debits = round($debits, 4);
                $credits = round($credits, 4);

                if (
                    abs($debits - $credits)
                    > 0.00005
                ) {
                    $validator->errors()->add(
                        'lines',
                        'Journal debit and credit totals '
                        . 'must balance.'
                    );
                }

                if ($debits <= 0) {
                    $validator->errors()->add(
                        'lines',
                        'Journal total must be greater '
                        . 'than zero.'
                    );
                }
            }
        );
    }
}
