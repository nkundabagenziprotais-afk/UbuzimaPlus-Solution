<?php

namespace App\Services\Finance;

use App\Models\FinanceAccountMapping;
use App\Models\FinanceChartOfAccount;
use App\Models\FinanceExpense;
use App\Models\FinanceExpenseAction;
use App\Models\FinanceJournalDraft;
use App\Models\PharmacoSupplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class FinanceExpenseWorkflowService
{
    private const PAYMENT_MAPPINGS = [
        'cash' => 'pos.cash',
        'bank' => 'pos.bank',
        'card' => 'pos.card',
        'momo' => 'pos.momo',
        'unpaid' => 'supplier.ap',
    ];

    public function __construct(
        private readonly FinanceJournalWorkflowService
            $journalWorkflow,

        private readonly FinanceAccountResolver
            $accountResolver,

        private readonly FinancePeriodGuard
            $periodGuard,
    ) {
    }

    /**
     * @return array{
     *   expense:FinanceExpense,
     *   replayed:bool
     * }
     */
    public function create(
        int $tenantId,
        ?int $branchId,
        array $data,
        int $actorId,
        string $idempotencyKey,
    ): array {
        $validated =
            $this->validatedPayload(
                $tenantId,
                $branchId,
                $data
            );

        $fingerprint =
            $this->requestFingerprint(
                $validated
            );

        return DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $actorId,
                $idempotencyKey,
                $fingerprint,
                $validated,
            ): array {
                $existing =
                    FinanceExpense::query()
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'idempotency_key',
                            $idempotencyKey
                        )
                        ->lockForUpdate()
                        ->first();

                if ($existing) {
                    if (
                        ! hash_equals(
                            (string)
                                $existing
                                    ->request_fingerprint,
                            $fingerprint
                        )
                    ) {
                        throw ValidationException::
                            withMessages([
                                'idempotency_key' => [
                                    'This Idempotency-Key '
                                    . 'was already used '
                                    . 'for a different '
                                    . 'Expense request.',
                                ],
                            ]);
                    }

                    return [
                        'expense' =>
                            $this->freshExpense(
                                $existing
                            ),

                        'replayed' => true,
                    ];
                }

                $uuid =
                    (string)
                        Str::uuid();

                $expense =
                    FinanceExpense::query()
                        ->create([
                            'uuid' =>
                                $uuid,

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'expense_number' =>
                                $this->expenseNumber(
                                    $tenantId,
                                    $validated[
                                        'business_date'
                                    ],
                                    $uuid
                                ),

                            'idempotency_key' =>
                                $idempotencyKey,

                            'request_fingerprint' =>
                                $fingerprint,

                            'business_date' =>
                                $validated[
                                    'business_date'
                                ],

                            'supplier_id' =>
                                $validated[
                                    'supplier_id'
                                ],

                            'payee_name' =>
                                $validated[
                                    'payee_name'
                                ],

                            'payment_source' =>
                                $validated[
                                    'payment_source'
                                ],

                            'reference_number' =>
                                $validated[
                                    'reference_number'
                                ],

                            'receipt_number' =>
                                $validated[
                                    'receipt_number'
                                ],

                            'purpose' =>
                                $validated[
                                    'purpose'
                                ],

                            'notes' =>
                                $validated[
                                    'notes'
                                ],

                            'currency_code' =>
                                $validated[
                                    'currency_code'
                                ],

                            'total_amount' =>
                                $validated[
                                    'total_amount'
                                ],

                            'status' => 'draft',

                            'prepared_by' =>
                                $actorId,

                            'version' => 1,

                            'metadata' => [
                                'domain' =>
                                    'finance_expenses',

                                'release' =>
                                    'R4A_V2',

                                'payment_mapping_key' =>
                                    $validated[
                                        'payment_mapping_key'
                                    ],

                                'payment_account_id' =>
                                    $validated[
                                        'payment_account_id'
                                    ],
                            ],
                        ]);

                $this->replaceLines(
                    $expense,
                    $validated['lines']
                );

                $this->appendAction(
                    $expense,
                    $actorId,
                    'created',
                    null,
                    'draft',
                    null,
                    [
                        'idempotency_key' =>
                            $idempotencyKey,
                    ]
                );

                return [
                    'expense' =>
                        $this->freshExpense(
                            $expense
                        ),

                    'replayed' => false,
                ];
            }
        );
    }

    public function update(
        FinanceExpense $expense,
        array $data,
        int $actorId,
    ): FinanceExpense {
        return DB::transaction(
            function () use (
                $expense,
                $data,
                $actorId,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                $this->assertEditable(
                    $locked
                );

                $expectedVersion =
                    (int) (
                        $data[
                            'expected_version'
                        ] ?? 0
                    );

                if (
                    $expectedVersion < 1
                    ||
                    $expectedVersion !==
                        (int)
                            $locked->version
                ) {
                    throw ValidationException::
                        withMessages([
                            'expected_version' => [
                                'This Expense was '
                                . 'changed by another '
                                . 'operation. Refresh '
                                . 'before editing again.',
                            ],
                        ]);
                }

                unset(
                    $data[
                        'expected_version'
                    ]
                );

                $validated =
                    $this->validatedPayload(
                        (int)
                            $locked->tenant_id,

                        $this->branchId(
                            $locked
                        ),

                        $data
                    );

                $previous =
                    (string)
                        $locked->status;

                $metadata =
                    is_array(
                        $locked->metadata
                    )
                        ? $locked->metadata
                        : [];

                $metadata[
                    'payment_mapping_key'
                ] =
                    $validated[
                        'payment_mapping_key'
                    ];

                $metadata[
                    'payment_account_id'
                ] =
                    $validated[
                        'payment_account_id'
                    ];

                $locked->forceFill([
                    /*
                     * request_fingerprint is intentionally
                     * immutable after creation.
                     */
                    'business_date' =>
                        $validated[
                            'business_date'
                        ],

                    'supplier_id' =>
                        $validated[
                            'supplier_id'
                        ],

                    'payee_name' =>
                        $validated[
                            'payee_name'
                        ],

                    'payment_source' =>
                        $validated[
                            'payment_source'
                        ],

                    'reference_number' =>
                        $validated[
                            'reference_number'
                        ],

                    'receipt_number' =>
                        $validated[
                            'receipt_number'
                        ],

                    'purpose' =>
                        $validated[
                            'purpose'
                        ],

                    'notes' =>
                        $validated[
                            'notes'
                        ],

                    'currency_code' =>
                        $validated[
                            'currency_code'
                        ],

                    'total_amount' =>
                        $validated[
                            'total_amount'
                        ],

                    'status' => 'draft',

                    'rejected_by' =>
                        null,

                    'rejected_at' =>
                        null,

                    'rejection_reason' =>
                        null,

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,

                    'metadata' =>
                        $metadata,
                ])->save();

                $this->replaceLines(
                    $locked,
                    $validated['lines']
                );

                $this->appendAction(
                    $locked,
                    $actorId,
                    'updated',
                    $previous,
                    'draft'
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    public function submit(
        FinanceExpense $expense,
        int $actorId,
    ): FinanceExpense {
        return DB::transaction(
            function () use (
                $expense,
                $actorId,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->with('lines')
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                if (
                    ! in_array(
                        $locked->status,
                        [
                            'draft',
                            'rejected',
                        ],
                        true
                    )
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a draft or '
                                . 'rejected Expense '
                                . 'may be submitted.',
                            ],
                        ]);
                }

                /*
                 * Dedicated mandatory period control.
                 */
                $this->assertOpenPeriod(
                    (int)
                        $locked->tenant_id,

                    $this->branchId(
                        $locked
                    ),

                    $this->businessDate(
                        $locked
                    )
                );

                $validated =
                    $this->validatedPayload(
                        (int)
                            $locked->tenant_id,

                        $this->branchId(
                            $locked
                        ),

                        $this->payloadFromExpense(
                            $locked
                        )
                    );

                $journalPayload =
                    $this->journalPayload(
                        $locked,
                        $validated
                    );

                if (
                    $locked
                        ->finance_journal_draft_id
                ) {
                    $draft =
                        FinanceJournalDraft::query()
                            ->where(
                                'tenant_id',
                                $locked->tenant_id
                            )
                            ->findOrFail(
                                $locked
                                    ->finance_journal_draft_id
                            );

                    $draft =
                        $this
                            ->journalWorkflow
                            ->update(
                                $draft,
                                $journalPayload,
                                $actorId
                            );
                } else {
                    $draft =
                        $this
                            ->journalWorkflow
                            ->create(
                                (int)
                                    $locked->tenant_id,

                                $this->branchId(
                                    $locked
                                ),

                                $journalPayload,
                                $actorId
                            );
                }

                $submitted =
                    $this
                        ->journalWorkflow
                        ->submit(
                            $draft,
                            $actorId
                        );

                $previous =
                    (string)
                        $locked->status;

                $locked->forceFill([
                    'status' =>
                        'submitted',

                    'submitted_by' =>
                        $actorId,

                    'submitted_at' =>
                        now(),

                    'finance_journal_draft_id'
                        => $submitted->getKey(),

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,
                ])->save();

                $this->appendAction(
                    $locked,
                    $actorId,
                    'submitted',
                    $previous,
                    'submitted',
                    null,
                    [
                        'journal_draft_id' =>
                            $submitted
                                ->getKey(),
                    ]
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    public function approve(
        FinanceExpense $expense,
        int $actorId,
        ?string $comment = null,
    ): FinanceExpense {
        return DB::transaction(
            function () use (
                $expense,
                $actorId,
                $comment,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                if (
                    $locked->status !==
                    'submitted'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a submitted '
                                . 'Expense may be '
                                . 'approved.',
                            ],
                        ]);
                }

                $draft =
                    $this->linkedDraft(
                        $locked
                    );

                $approved =
                    $this
                        ->journalWorkflow
                        ->approve(
                            $draft,
                            $actorId,
                            $comment
                        );

                $locked->forceFill([
                    'status' =>
                        'approved',

                    'approved_by' =>
                        $actorId,

                    'approved_at' =>
                        now(),

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,
                ])->save();

                $this->appendAction(
                    $locked,
                    $actorId,
                    'approved',
                    'submitted',
                    'approved',
                    $comment,
                    [
                        'journal_draft_id' =>
                            $approved
                                ->getKey(),
                    ]
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    public function reject(
        FinanceExpense $expense,
        int $actorId,
        string $comment,
    ): FinanceExpense {
        $comment =
            trim($comment);

        if ($comment === '') {
            throw ValidationException::
                withMessages([
                    'comment' => [
                        'A rejection reason '
                        . 'is required.',
                    ],
                ]);
        }

        return DB::transaction(
            function () use (
                $expense,
                $actorId,
                $comment,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                if (
                    $locked->status !==
                    'submitted'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a submitted '
                                . 'Expense may be '
                                . 'rejected.',
                            ],
                        ]);
                }

                $draft =
                    $this->linkedDraft(
                        $locked
                    );

                $this
                    ->journalWorkflow
                    ->reject(
                        $draft,
                        $actorId,
                        $comment
                    );

                $locked->forceFill([
                    'status' =>
                        'rejected',

                    'rejected_by' =>
                        $actorId,

                    'rejected_at' =>
                        now(),

                    'rejection_reason' =>
                        $comment,

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,
                ])->save();

                $this->appendAction(
                    $locked,
                    $actorId,
                    'rejected',
                    'submitted',
                    'rejected',
                    $comment
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    public function post(
        FinanceExpense $expense,
        int $actorId,
    ): FinanceExpense {
        return DB::transaction(
            function () use (
                $expense,
                $actorId,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                if (
                    $locked->status ===
                        'posted'
                    &&
                    $locked
                        ->posted_journal_entry_id
                ) {
                    return $this->freshExpense(
                        $locked
                    );
                }

                if (
                    $locked->status !==
                    'approved'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only an approved '
                                . 'Expense may be '
                                . 'posted.',
                            ],
                        ]);
                }

                /*
                 * Re-check period because it may have
                 * closed after approval.
                 */
                $this->assertOpenPeriod(
                    (int)
                        $locked->tenant_id,

                    $this->branchId(
                        $locked
                    ),

                    $this->businessDate(
                        $locked
                    )
                );

                $draft =
                    $this->linkedDraft(
                        $locked
                    );

                $entry =
                    $this
                        ->journalWorkflow
                        ->post(
                            $draft,
                            $actorId
                        );

                $locked->forceFill([
                    'status' =>
                        'posted',

                    'posted_by' =>
                        $actorId,

                    'posted_at' =>
                        now(),

                    'posted_journal_entry_id'
                        => $entry->getKey(),

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,
                ])->save();

                $this->appendAction(
                    $locked,
                    $actorId,
                    'posted',
                    'approved',
                    'posted',
                    null,
                    [
                        'journal_entry_id' =>
                            $entry->getKey(),
                    ]
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    public function reverse(
        FinanceExpense $expense,
        int $actorId,
        string $businessDate,
        string $reason,
    ): FinanceExpense {
        $reason =
            trim($reason);

        if ($reason === '') {
            throw ValidationException::
                withMessages([
                    'reason' => [
                        'A reversal reason '
                        . 'is required.',
                    ],
                ]);
        }

        return DB::transaction(
            function () use (
                $expense,
                $actorId,
                $businessDate,
                $reason,
            ): FinanceExpense {
                $locked =
                    FinanceExpense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->getKey()
                        );

                if (
                    $locked->status ===
                        'reversed'
                    &&
                    $locked
                        ->reversal_journal_entry_id
                ) {
                    return $this->freshExpense(
                        $locked
                    );
                }

                if (
                    $locked->status !==
                    'posted'
                ) {
                    throw ValidationException::
                        withMessages([
                            'status' => [
                                'Only a posted '
                                . 'Expense may be '
                                . 'reversed.',
                            ],
                        ]);
                }

                $this->assertOpenPeriod(
                    (int)
                        $locked->tenant_id,

                    $this->branchId(
                        $locked
                    ),

                    $businessDate
                );

                $draft =
                    $this->linkedDraft(
                        $locked
                    );

                $entry =
                    $this
                        ->journalWorkflow
                        ->reverse(
                            $draft,
                            $actorId,
                            $businessDate,
                            $reason
                        );

                $locked->forceFill([
                    'status' =>
                        'reversed',

                    'reversed_by' =>
                        $actorId,

                    'reversed_at' =>
                        now(),

                    'reversal_reason' =>
                        $reason,

                    'reversal_journal_entry_id'
                        => $entry->getKey(),

                    'version' =>
                        ((int)
                            $locked->version)
                        + 1,
                ])->save();

                $this->appendAction(
                    $locked,
                    $actorId,
                    'reversed',
                    'posted',
                    'reversed',
                    $reason,
                    [
                        'reversal_journal_entry_id'
                            => $entry->getKey(),
                    ]
                );

                return $this->freshExpense(
                    $locked
                );
            }
        );
    }

    private function validatedPayload(
        int $tenantId,
        ?int $branchId,
        array $data,
    ): array {
        $currency =
            strtoupper(
                trim(
                    (string) (
                        $data[
                            'currency_code'
                        ]
                        ?? 'RWF'
                    )
                )
            );

        if ($currency !== 'RWF') {
            throw ValidationException::
                withMessages([
                    'currency_code' => [
                        'Expenses currently '
                        . 'support RWF only.',
                    ],
                ]);
        }

        $paymentSource =
            strtolower(
                trim(
                    (string) (
                        $data[
                            'payment_source'
                        ]
                        ?? ''
                    )
                )
            );

        if (
            ! array_key_exists(
                $paymentSource,
                self::PAYMENT_MAPPINGS
            )
        ) {
            throw ValidationException::
                withMessages([
                    'payment_source' => [
                        'Unsupported Expense '
                        . 'payment source.',
                    ],
                ]);
        }

        $supplierId =
            isset(
                $data['supplier_id']
            )
            &&
            $data['supplier_id'] !==
                null
                ? (int)
                    $data['supplier_id']
                : null;

        if (
            $paymentSource ===
                'unpaid'
            &&
            $supplierId === null
        ) {
            throw ValidationException::
                withMessages([
                    'supplier_id' => [
                        'A supplier is required '
                        . 'for an unpaid Expense.',
                    ],
                ]);
        }

        if ($supplierId !== null) {
            $supplier =
                PharmacoSupplier::query()
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'status',
                        'active'
                    )
                    ->find(
                        $supplierId
                    );

            if (! $supplier) {
                throw ValidationException::
                    withMessages([
                        'supplier_id' => [
                            'The supplier is not '
                            . 'active within the '
                            . 'verified tenant.',
                        ],
                    ]);
            }
        }

        $paymentMappingKey =
            self::PAYMENT_MAPPINGS[
                $paymentSource
            ];

        try {
            $paymentAccountId =
                $this
                    ->accountResolver
                    ->resolve(
                        $tenantId,
                        $branchId,
                        $paymentMappingKey,
                        $currency
                    );
        } catch (Throwable) {
            throw ValidationException::
                withMessages([
                    'payment_source' => [
                        'The selected payment '
                        . 'source has no valid '
                        . 'Finance mapping.',
                    ],
                ]);
        }

        $rawLines =
            $data['lines'] ?? [];

        if (
            ! is_array($rawLines)
            ||
            count($rawLines) < 1
            ||
            count($rawLines) > 50
        ) {
            throw ValidationException::
                withMessages([
                    'lines' => [
                        'An Expense requires '
                        . 'between 1 and 50 '
                        . 'Expense lines.',
                    ],
                ]);
        }

        $lines = [];
        $total = 0.0;

        foreach (
            array_values($rawLines)
            as $index => $line
        ) {
            if (! is_array($line)) {
                throw ValidationException::
                    withMessages([
                        "lines.$index" => [
                            'Invalid Expense line.',
                        ],
                    ]);
            }

            $accountId =
                (int) (
                    $line[
                        'finance_chart_of_account_id'
                    ]
                    ?? 0
                );

            $amount =
                round(
                    (float) (
                        $line['amount']
                        ?? 0
                    ),
                    4
                );

            if ($amount <= 0) {
                throw ValidationException::
                    withMessages([
                        "lines.$index.amount" => [
                            'Expense line amount '
                            . 'must be greater '
                            . 'than zero.',
                        ],
                    ]);
            }

            $account =
                FinanceChartOfAccount::query()
                    ->whereKey(
                        $accountId
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->where(
                        'is_active',
                        true
                    )
                    ->first();

            if (
                ! $account
                ||
                strtolower(
                    (string)
                        $account->account_type
                ) !== 'expense'
            ) {
                throw ValidationException::
                    withMessages([
                        "lines.$index."
                        . "finance_chart_of_account_id"
                            => [
                                'The selected '
                                . 'account must be '
                                . 'an active Expense '
                                . 'account in the '
                                . 'verified tenant.',
                            ],
                    ]);
            }

            $mappingKey =
                $this->mappingKeyForAccount(
                    $tenantId,
                    $branchId,
                    $accountId,
                    $currency
                );

            $description =
                $this->nullableText(
                    $line[
                        'description'
                    ]
                    ?? null
                );

            $lines[] = [
                'finance_chart_of_account_id'
                    => $accountId,

                'mapping_key'
                    => $mappingKey,

                'description'
                    => $description,

                'amount'
                    => $amount,
            ];

            $total += $amount;
        }

        $total =
            round(
                $total,
                4
            );

        if ($total <= 0) {
            throw ValidationException::
                withMessages([
                    'total_amount' => [
                        'Expense total must '
                        . 'be greater than zero.',
                    ],
                ]);
        }

        $purpose =
            trim(
                (string) (
                    $data['purpose']
                    ?? ''
                )
            );

        if ($purpose === '') {
            throw ValidationException::
                withMessages([
                    'purpose' => [
                        'Business purpose '
                        . 'is required.',
                    ],
                ]);
        }

        return [
            'business_date' =>
                (string)
                    $data[
                        'business_date'
                    ],

            'supplier_id' =>
                $supplierId,

            'payee_name' =>
                $this->nullableText(
                    $data[
                        'payee_name'
                    ]
                    ?? null
                ),

            'payment_source' =>
                $paymentSource,

            'payment_mapping_key' =>
                $paymentMappingKey,

            'payment_account_id' =>
                $paymentAccountId,

            'reference_number' =>
                $this->nullableText(
                    $data[
                        'reference_number'
                    ]
                    ?? null
                ),

            'receipt_number' =>
                $this->nullableText(
                    $data[
                        'receipt_number'
                    ]
                    ?? null
                ),

            'purpose' =>
                $purpose,

            'notes' =>
                $this->nullableText(
                    $data['notes']
                    ?? null
                ),

            'currency_code' =>
                $currency,

            'total_amount' =>
                $total,

            'lines' =>
                $lines,
        ];
    }

    private function journalPayload(
        FinanceExpense $expense,
        array $validated,
    ): array {
        $lines = [];

        foreach (
            $validated['lines']
            as $line
        ) {
            $lines[] = [
                'finance_chart_of_account_id'
                    => $line[
                        'finance_chart_of_account_id'
                    ],

                'description'
                    => $line[
                        'description'
                    ]
                    ?? $expense->purpose,

                'debit_amount'
                    => $line['amount'],

                'credit_amount'
                    => 0,
            ];
        }

        $lines[] = [
            'finance_chart_of_account_id'
                => $validated[
                    'payment_account_id'
                ],

            'description'
                => 'Expense payment source: '
                    . strtoupper(
                        $validated[
                            'payment_source'
                        ]
                    ),

            'debit_amount'
                => 0,

            'credit_amount'
                => $validated[
                    'total_amount'
                ],
        ];

        return [
            'business_date' =>
                $validated[
                    'business_date'
                ],

            'reference' =>
                (string)
                    $expense
                        ->expense_number,

            'description' =>
                (string)
                    $validated[
                        'purpose'
                    ],

            'currency_code' =>
                (string)
                    $validated[
                        'currency_code'
                    ],

            'lines' =>
                $lines,
        ];
    }

    private function payloadFromExpense(
        FinanceExpense $expense,
    ): array {
        if (
            ! $expense
                ->relationLoaded(
                    'lines'
                )
        ) {
            $expense->load('lines');
        }

        return [
            'business_date' =>
                $this->businessDate(
                    $expense
                ),

            'supplier_id' =>
                $expense->supplier_id,

            'payee_name' =>
                $expense->payee_name,

            'payment_source' =>
                $expense->payment_source,

            'reference_number' =>
                $expense
                    ->reference_number,

            'receipt_number' =>
                $expense
                    ->receipt_number,

            'purpose' =>
                $expense->purpose,

            'notes' =>
                $expense->notes,

            'currency_code' =>
                $expense
                    ->currency_code,

            'lines' =>
                $expense
                    ->lines
                    ->map(
                        static fn (
                            $line
                        ): array => [
                            'finance_chart_of_account_id'
                                => (int)
                                    $line
                                        ->finance_chart_of_account_id,

                            'description'
                                => $line
                                    ->description,

                            'amount'
                                => (float)
                                    $line
                                        ->amount,
                        ]
                    )
                    ->values()
                    ->all(),
        ];
    }

    private function replaceLines(
        FinanceExpense $expense,
        array $lines,
    ): void {
        $expense
            ->lines()
            ->delete();

        foreach (
            array_values($lines)
            as $index => $line
        ) {
            $expense
                ->lines()
                ->create([
                    'line_number' =>
                        $index + 1,

                    'finance_chart_of_account_id'
                        => $line[
                            'finance_chart_of_account_id'
                        ],

                    'description' =>
                        $line[
                            'description'
                        ],

                    'amount' =>
                        $line[
                            'amount'
                        ],

                    'mapping_key' =>
                        $line[
                            'mapping_key'
                        ],

                    'metadata' => [
                        'source' =>
                            'finance_expense',
                    ],
                ]);
        }
    }

    private function mappingKeyForAccount(
        int $tenantId,
        ?int $branchId,
        int $accountId,
        string $currency,
    ): string {
        $query =
            FinanceAccountMapping::query()
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'finance_chart_of_account_id',
                    $accountId
                )
                ->where(
                    'currency_code',
                    $currency
                )
                ->where(
                    'is_active',
                    true
                )
                ->where(
                    function ($builder)
                    use ($branchId): void {
                        $builder
                            ->whereNull(
                                'branch_id'
                            );

                        if (
                            $branchId !== null
                        ) {
                            $builder
                                ->orWhere(
                                    'branch_id',
                                    $branchId
                                );
                        }
                    }
                );

        if ($branchId !== null) {
            $query->orderByRaw(
                'CASE '
                . 'WHEN branch_id = ? '
                . 'THEN 0 '
                . 'WHEN branch_id IS NULL '
                . 'THEN 1 '
                . 'ELSE 2 END',
                [$branchId]
            );
        } else {
            $query->whereNull(
                'branch_id'
            );
        }

        foreach (
            $query->get()
            as $mapping
        ) {
            try {
                $resolved =
                    $this
                        ->accountResolver
                        ->resolve(
                            $tenantId,
                            $branchId,
                            (string)
                                $mapping
                                    ->mapping_key,
                            $currency
                        );
            } catch (Throwable) {
                continue;
            }

            if (
                $resolved ===
                $accountId
            ) {
                return (string)
                    $mapping
                        ->mapping_key;
            }
        }

        throw ValidationException::
            withMessages([
                'mapping' => [
                    'No active Finance mapping '
                    . 'resolves to the selected '
                    . 'Expense account.',
                ],
            ]);
    }

    private function assertOpenPeriod(
        int $tenantId,
        ?int $branchId,
        string $businessDate,
    ): void {
        try {
            $period =
                $this
                    ->periodGuard
                    ->openPeriodFor(
                        $tenantId,
                        $branchId,
                        $businessDate
                    );
        } catch (Throwable $exception) {
            throw ValidationException::
                withMessages([
                    'business_date' => [
                        $exception
                            ->getMessage()
                        ?: (
                            'Accounting period '
                            . 'is unavailable.'
                        ),
                    ],
                ]);
        }

        if ($period === null) {
            throw ValidationException::
                withMessages([
                    'business_date' => [
                        'No open Accounting '
                        . 'period is configured '
                        . 'for this Expense '
                        . 'business date.',
                    ],
                ]);
        }

        if (
            method_exists(
                $period,
                'isClosedOrLocked'
            )
            &&
            $period
                ->isClosedOrLocked()
        ) {
            throw ValidationException::
                withMessages([
                    'business_date' => [
                        'The Accounting period '
                        . 'is closed or locked.',
                    ],
                ]);
        }
    }

    private function linkedDraft(
        FinanceExpense $expense,
    ): FinanceJournalDraft {
        if (
            ! $expense
                ->finance_journal_draft_id
        ) {
            throw ValidationException::
                withMessages([
                    'journal' => [
                        'The Expense has no '
                        . 'linked Finance '
                        . 'journal draft.',
                    ],
                ]);
        }

        return FinanceJournalDraft::query()
            ->where(
                'tenant_id',
                $expense->tenant_id
            )
            ->findOrFail(
                $expense
                    ->finance_journal_draft_id
            );
    }

    private function assertEditable(
        FinanceExpense $expense,
    ): void {
        if (
            ! in_array(
                $expense->status,
                [
                    'draft',
                    'rejected',
                ],
                true
            )
        ) {
            throw ValidationException::
                withMessages([
                    'status' => [
                        'Only a draft or '
                        . 'rejected Expense '
                        . 'may be edited.',
                    ],
                ]);
        }
    }

    private function requestFingerprint(
        array $validated,
    ): string {
        /*
         * Fingerprint only user/business request
         * semantics, not current mapping resolution.
         */
        $canonical = [
            'business_date' =>
                $validated[
                    'business_date'
                ],

            'supplier_id' =>
                $validated[
                    'supplier_id'
                ],

            'payee_name' =>
                $validated[
                    'payee_name'
                ],

            'payment_source' =>
                $validated[
                    'payment_source'
                ],

            'reference_number' =>
                $validated[
                    'reference_number'
                ],

            'receipt_number' =>
                $validated[
                    'receipt_number'
                ],

            'purpose' =>
                $validated[
                    'purpose'
                ],

            'notes' =>
                $validated[
                    'notes'
                ],

            'currency_code' =>
                $validated[
                    'currency_code'
                ],

            'lines' =>
                array_map(
                    static fn (
                        array $line
                    ): array => [
                        'finance_chart_of_account_id'
                            => $line[
                                'finance_chart_of_account_id'
                            ],

                        'description'
                            => $line[
                                'description'
                            ],

                        'amount'
                            => $line[
                                'amount'
                            ],
                    ],
                    $validated['lines']
                ),
        ];

        return hash(
            'sha256',
            json_encode(
                $canonical,
                JSON_UNESCAPED_SLASHES
                |
                JSON_PRESERVE_ZERO_FRACTION
                |
                JSON_THROW_ON_ERROR
            )
        );
    }

    private function appendAction(
        FinanceExpense $expense,
        ?int $actorId,
        string $action,
        ?string $previousStatus,
        string $newStatus,
        ?string $comment = null,
        array $metadata = [],
    ): FinanceExpenseAction {
        return FinanceExpenseAction::query()
            ->create([
                'uuid' =>
                    (string)
                        Str::uuid(),

                'finance_expense_id' =>
                    $expense->getKey(),

                'tenant_id' =>
                    (int)
                        $expense
                            ->tenant_id,

                'actor_id' =>
                    $actorId,

                'action' =>
                    $action,

                'previous_status' =>
                    $previousStatus,

                'new_status' =>
                    $newStatus,

                'comment' =>
                    $comment,

                'metadata' =>
                    $metadata,

                'acted_at' =>
                    now(),
            ]);
    }

    private function expenseNumber(
        int $tenantId,
        string $businessDate,
        string $uuid,
    ): string {
        return
            'EXP-'
            . $tenantId
            . '-'
            . str_replace(
                '-',
                '',
                $businessDate
            )
            . '-'
            . strtoupper(
                substr(
                    str_replace(
                        '-',
                        '',
                        $uuid
                    ),
                    0,
                    10
                )
            );
    }

    private function branchId(
        FinanceExpense $expense,
    ): ?int {
        return
            $expense->branch_id ===
            null
                ? null
                : (int)
                    $expense->branch_id;
    }

    private function businessDate(
        FinanceExpense $expense,
    ): string {
        $value =
            $expense->business_date;

        if (
            $value instanceof
            \DateTimeInterface
        ) {
            return $value->format(
                'Y-m-d'
            );
        }

        return substr(
            (string) $value,
            0,
            10
        );
    }

    private function nullableText(
        mixed $value,
    ): ?string {
        if ($value === null) {
            return null;
        }

        $text =
            trim(
                (string) $value
            );

        return
            $text === ''
                ? null
                : $text;
    }

    private function freshExpense(
        FinanceExpense $expense,
    ): FinanceExpense {
        return $expense
            ->fresh([
                'lines.account',
                'actions.actor',
                'supplier',
                'journalDraft.lines.account',
                'postedJournal',
                'reversalJournal',
            ]);
    }
}
