<?php

namespace App\Http\Requests\Accounting;

use Illuminate\Foundation\Http\FormRequest;

class StoreFinanceExpenseRequest extends FormRequest
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
            'expense_number' => ['prohibited'],
            'idempotency_key' => ['prohibited'],
            'request_fingerprint' => ['prohibited'],
            'status' => ['prohibited'],
            'total_amount' => ['prohibited'],
            'version' => ['prohibited'],

            'prepared_by' => ['prohibited'],
            'submitted_by' => ['prohibited'],
            'approved_by' => ['prohibited'],
            'posted_by' => ['prohibited'],
            'rejected_by' => ['prohibited'],
            'reversed_by' => ['prohibited'],

            'finance_journal_draft_id' => ['prohibited'],
            'posted_journal_entry_id' => ['prohibited'],
            'reversal_journal_entry_id' => ['prohibited'],

            'evidence_disk' => ['prohibited'],
            'evidence_path' => ['prohibited'],
            'evidence_original_name' => ['prohibited'],
            'evidence_mime_type' => ['prohibited'],
            'evidence_size' => ['prohibited'],
            'evidence_uploaded_by' => ['prohibited'],
            'evidence_uploaded_at' => ['prohibited'],

            'metadata' => ['prohibited'],

            'business_date' => [
                'required',
                'date_format:Y-m-d',
            ],

            'supplier_id' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'payee_name' => [
                'nullable',
                'string',
                'max:191',
            ],

            'payment_source' => [
                'required',
                'string',
                'in:cash,bank,card,momo,unpaid',
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'receipt_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'purpose' => [
                'required',
                'string',
                'max:2000',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:4000',
            ],

            'currency_code' => [
                'sometimes',
                'string',
                'in:RWF',
            ],

            'lines' => [
                'required',
                'array',
                'min:1',
                'max:50',
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

            'lines.*.amount' => [
                'required',
                'numeric',
                'gt:0',
            ],
        ];
    }
}
