<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Accounting\AccountingRequestScope;
use App\Services\Finance\FinanceLedgerReportingScope;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FinanceBankReconciliationController extends Controller
{
    public function __construct(
        private readonly AccountingRequestScope $requestScope,
        private readonly FinanceLedgerReportingScope $reportingScope,
    ) {
    }

    /*
     * AQUILA_QUICKBOOKS_QB2_2_R1_2
     */

    public function accounts(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $rows =
            DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'is_active',
                    true
                )
                ->where(
                    'account_type',
                    'asset'
                )
                ->where(
                    function ($query): void {
                        $query
                            ->where(
                                'code',
                                '1010'
                            )
                            ->orWhereRaw(
                                'LOWER(name) LIKE ?',
                                [
                                    '%bank%',
                                ]
                            );
                    }
                )
                ->orderBy(
                    'code'
                )
                ->get([
                    'id',
                    'code',
                    'name',
                    'normal_balance',
                ])
                ->map(
                    function ($account) use (
                        $tenantId,
                        $branchId
                    ): array {
                        return [
                            'id' =>
                                (int) $account->id,

                            'code' =>
                                (string) $account->code,

                            'name' =>
                                (string) $account->name,

                            'normal_balance' =>
                                $account->normal_balance,

                            'book_balance' =>
                                $this->bookBalance(
                                    $tenantId,
                                    $branchId,
                                    (int) $account->id,
                                    now()->toDateString()
                                ),
                        ];
                    }
                )
                ->values();

        return response()->json([
            'data' =>
                $rows,

            'account_master' =>
                'existing-finance-chart-of-accounts',

            'read_only' =>
                true,
        ]);
    }

    public function imports(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $rows =
            DB::table(
                'finance_bank_statement_imports as imports'
            )
                ->leftJoin(
                    'finance_chart_of_accounts as accounts',
                    'accounts.id',
                    '=',
                    'imports.chart_of_account_id'
                )
                ->leftJoin(
                    'finance_bank_reconciliation_sessions as sessions',
                    'sessions.statement_import_id',
                    '=',
                    'imports.id'
                )
                ->where(
                    'imports.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'imports.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'imports.id'
                )
                ->limit(
                    100
                )
                ->get([
                    'imports.id',
                    'imports.uuid',
                    'imports.chart_of_account_id',
                    'imports.statement_from',
                    'imports.statement_to',
                    'imports.opening_balance',
                    'imports.closing_balance',
                    'imports.statement_movement',
                    'imports.calculated_closing_balance',
                    'imports.statement_variance',
                    'imports.currency_code',
                    'imports.source_file_name',
                    'imports.status',
                    'imports.imported_at',

                    'accounts.code as account_code',
                    'accounts.name as account_name',

                    'sessions.uuid as session_uuid',
                    'sessions.status as session_status',
                ]);

        $data =
            $rows
                ->map(
                    function ($row) use (
                        $tenantId
                    ): array {
                        $lineCount =
                            DB::table(
                                'finance_bank_statement_lines'
                            )
                                ->where(
                                    'tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'statement_import_id',
                                    $row->id
                                )
                                ->count();

                        $matchedCount =
                            DB::table(
                                'finance_bank_statement_matches as matches'
                            )
                                ->join(
                                    'finance_bank_statement_lines as lines',
                                    'lines.id',
                                    '=',
                                    'matches.statement_line_id'
                                )
                                ->where(
                                    'matches.tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'lines.statement_import_id',
                                    $row->id
                                )
                                ->count();

                        return [
                            'uuid' =>
                                $row->uuid,

                            'chart_of_account_id' =>
                                (int) $row->chart_of_account_id,

                            'account_code' =>
                                $row->account_code,

                            'account_name' =>
                                $row->account_name,

                            'statement_from' =>
                                $row->statement_from,

                            'statement_to' =>
                                $row->statement_to,

                            'opening_balance' =>
                                (float) $row->opening_balance,

                            'closing_balance' =>
                                (float) $row->closing_balance,

                            'statement_movement' =>
                                (float) $row->statement_movement,

                            'calculated_closing_balance' =>
                                (float) $row->calculated_closing_balance,

                            'statement_variance' =>
                                (float) $row->statement_variance,

                            'currency_code' =>
                                $row->currency_code,

                            'source_file_name' =>
                                $row->source_file_name,

                            'status' =>
                                $row->status,

                            'line_count' =>
                                (int) $lineCount,

                            'matched_count' =>
                                (int) $matchedCount,

                            'unmatched_count' =>
                                max(
                                    0,
                                    (int) $lineCount
                                    -
                                    (int) $matchedCount
                                ),

                            'session_uuid' =>
                                $row->session_uuid,

                            'session_status' =>
                                $row->session_status,

                            'imported_at' =>
                                $row->imported_at,
                        ];
                    }
                )
                ->values();

        return response()->json([
            'data' =>
                $data,

            'read_only' =>
                true,
        ]);
    }

    public function showImport(
        Request $request,
        string $uuid
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $import =
            $this->findImport(
                $tenantId,
                $branchId,
                $uuid
            );

        $rows =
            DB::table(
                'finance_bank_statement_lines as lines'
            )
                ->leftJoin(
                    'finance_bank_statement_matches as matches',
                    'matches.statement_line_id',
                    '=',
                    'lines.id'
                )
                ->where(
                    'lines.tenant_id',
                    $tenantId
                )
                ->where(
                    'lines.statement_import_id',
                    $import->id
                )
                ->orderBy(
                    'lines.line_number'
                )
                ->get([
                    'lines.uuid',
                    'lines.line_number',
                    'lines.transaction_date',
                    'lines.reference',
                    'lines.description',
                    'lines.amount',

                    'matches.uuid as match_uuid',
                    'matches.match_type',
                    'matches.match_id',
                    'matches.matched_amount',
                    'matches.match_method',
                    'matches.notes',
                    'matches.matched_at',
                ])
                ->map(
                    static fn ($row): array => [
                        'uuid' =>
                            $row->uuid,

                        'line_number' =>
                            (int) $row->line_number,

                        'transaction_date' =>
                            $row->transaction_date,

                        'reference' =>
                            $row->reference,

                        'description' =>
                            $row->description,

                        'amount' =>
                            (float) $row->amount,

                        'matched' =>
                            $row->match_uuid !== null,

                        'match' =>
                            $row->match_uuid !== null
                                ? [
                                    'uuid' =>
                                        $row->match_uuid,

                                    'type' =>
                                        $row->match_type,

                                    'id' =>
                                        (int) $row->match_id,

                                    'amount' =>
                                        (float) $row->matched_amount,

                                    'method' =>
                                        $row->match_method,

                                    'notes' =>
                                        $row->notes,

                                    'matched_at' =>
                                        $row->matched_at,
                                ]
                                : null,
                    ]
                )
                ->values();

        $session =
            DB::table(
                'finance_bank_reconciliation_sessions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_import_id',
                    $import->id
                )
                ->first([
                    'uuid',
                    'status',
                    'book_closing_balance',
                    'difference',
                    'locked_at',
                ]);

        return response()->json([
            'import' => [
                'uuid' =>
                    $import->uuid,

                'chart_of_account_id' =>
                    (int) $import->chart_of_account_id,

                'statement_from' =>
                    $import->statement_from,

                'statement_to' =>
                    $import->statement_to,

                'opening_balance' =>
                    (float) $import->opening_balance,

                'closing_balance' =>
                    (float) $import->closing_balance,

                'statement_movement' =>
                    (float) $import->statement_movement,

                'calculated_closing_balance' =>
                    (float) $import->calculated_closing_balance,

                'statement_variance' =>
                    (float) $import->statement_variance,

                'currency_code' =>
                    $import->currency_code,

                'status' =>
                    $import->status,
            ],

            'session' =>
                $session
                    ? [
                        'uuid' =>
                            $session->uuid,

                        'status' =>
                            $session->status,

                        'book_closing_balance' =>
                            (float) $session->book_closing_balance,

                        'difference' =>
                            (float) $session->difference,

                        'locked_at' =>
                            $session->locked_at,
                    ]
                    : null,

            'data' =>
                $rows,

            'read_only' =>
                true,
        ]);
    }

    public function importStatement(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId, $userId] =
            $this->scope(
                $request
            );

        $validated =
            $request->validate([
                'chart_of_account_id' => [
                    'required',
                    'integer',
                    'min:1',
                ],

                'statement_from' => [
                    'required',
                    'date_format:Y-m-d',
                ],

                'statement_to' => [
                    'required',
                    'date_format:Y-m-d',
                ],

                'opening_balance' => [
                    'required',
                    'numeric',
                ],

                'closing_balance' => [
                    'required',
                    'numeric',
                ],

                'currency_code' => [
                    'nullable',
                    'string',
                    'max:10',
                ],

                'statement' => [
                    'required',
                    'file',
                    'max:5120',
                ],
            ]);

        if (
            $validated['statement_from']
            >
            $validated['statement_to']
        ) {
            throw ValidationException::withMessages([
                'statement_to' => [
                    'Statement end date cannot be before the start date.',
                ],
            ]);
        }

        $account =
            DB::table(
                'finance_chart_of_accounts'
            )
                ->where(
                    'id',
                    (int) $validated[
                        'chart_of_account_id'
                    ]
                )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'is_active',
                    true
                )
                ->where(
                    'account_type',
                    'asset'
                )
                ->where(
                    function ($query): void {
                        $query
                            ->where(
                                'code',
                                '1010'
                            )
                            ->orWhereRaw(
                                'LOWER(name) LIKE ?',
                                [
                                    '%bank%',
                                ]
                            );
                    }
                )
                ->first([
                    'id',
                    'code',
                    'name',
                ]);

        if (! $account) {
            throw ValidationException::withMessages([
                'chart_of_account_id' => [
                    'Select an active Finance bank asset account.',
                ],
            ]);
        }

        $file =
            $request->file(
                'statement'
            );

        $extension =
            strtolower(
                (string) $file
                    ->getClientOriginalExtension()
            );

        if (
            ! in_array(
                $extension,
                [
                    'csv',
                    'txt',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'statement' => [
                    'QB2.2 accepts CSV statements only.',
                ],
            ]);
        }

        $realPath =
            $file->getRealPath();

        if (
            ! is_string(
                $realPath
            )
            ||
            $realPath === ''
            ||
            ! is_file(
                $realPath
            )
        ) {
            throw ValidationException::withMessages([
                'statement' => [
                    'The uploaded statement could not be read.',
                ],
            ]);
        }

        $fileSha =
            hash_file(
                'sha256',
                $realPath
            );

        $duplicate =
            DB::table(
                'finance_bank_statement_imports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'chart_of_account_id',
                    (int) $account->id
                )
                ->where(
                    'source_file_sha256',
                    $fileSha
                )
                ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'statement' => [
                    'This statement file has already been imported for this account.',
                ],
            ]);
        }

        $parsed =
            $this->parseStatement(
                $realPath,
                $validated['statement_from'],
                $validated['statement_to']
            );

        $opening =
            round(
                (float) $validated[
                    'opening_balance'
                ],
                2
            );

        $closing =
            round(
                (float) $validated[
                    'closing_balance'
                ],
                2
            );

        $movement =
            round(
                (float) $parsed['movement'],
                2
            );

        $calculatedClosing =
            round(
                $opening
                +
                $movement,
                2
            );

        $statementVariance =
            round(
                $closing
                -
                $calculatedClosing,
                2
            );

        $currency =
            strtoupper(
                trim(
                    (string) (
                        $validated[
                            'currency_code'
                        ]
                        ??
                        'RWF'
                    )
                )
            );

        if ($currency === '') {
            $currency =
                'RWF';
        }

        $uuid =
            (string) Str::uuid();

        DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $userId,
                $account,
                $validated,
                $opening,
                $closing,
                $movement,
                $calculatedClosing,
                $statementVariance,
                $currency,
                $file,
                $fileSha,
                $parsed,
                $uuid
            ): void {
                $now =
                    now();

                $importId =
                    DB::table(
                        'finance_bank_statement_imports'
                    )
                        ->insertGetId([
                            'uuid' =>
                                $uuid,

                            'tenant_id' =>
                                $tenantId,

                            'branch_id' =>
                                $branchId,

                            'chart_of_account_id' =>
                                (int) $account->id,

                            'statement_from' =>
                                $validated[
                                    'statement_from'
                                ],

                            'statement_to' =>
                                $validated[
                                    'statement_to'
                                ],

                            'opening_balance' =>
                                $opening,

                            'closing_balance' =>
                                $closing,

                            'statement_movement' =>
                                $movement,

                            'calculated_closing_balance' =>
                                $calculatedClosing,

                            'statement_variance' =>
                                $statementVariance,

                            'currency_code' =>
                                $currency,

                            'source_file_name' =>
                                mb_substr(
                                    (string) $file
                                        ->getClientOriginalName(),
                                    0,
                                    191
                                ),

                            'source_file_sha256' =>
                                $fileSha,

                            'status' =>
                                'imported',

                            'imported_by' =>
                                $userId,

                            'imported_at' =>
                                $now,

                            'created_at' =>
                                $now,

                            'updated_at' =>
                                $now,
                        ]);

                $records = [];

                foreach (
                    $parsed['lines']
                    as
                    $line
                ) {
                    $records[] = [
                        'uuid' =>
                            (string) Str::uuid(),

                        'tenant_id' =>
                            $tenantId,

                        'branch_id' =>
                            $branchId,

                        'statement_import_id' =>
                            $importId,

                        'chart_of_account_id' =>
                            (int) $account->id,

                        'line_number' =>
                            (int) $line[
                                'line_number'
                            ],

                        'transaction_date' =>
                            $line[
                                'transaction_date'
                            ],

                        'reference' =>
                            $line[
                                'reference'
                            ],

                        'description' =>
                            $line[
                                'description'
                            ],

                        'amount' =>
                            $line[
                                'amount'
                            ],

                        'created_at' =>
                            $now,

                        'updated_at' =>
                            $now,
                    ];
                }

                foreach (
                    array_chunk(
                        $records,
                        250
                    )
                    as
                    $chunk
                ) {
                    DB::table(
                        'finance_bank_statement_lines'
                    )->insert(
                        $chunk
                    );
                }
            }
        );

        return response()->json([
            'message' =>
                'Bank statement imported.',

            'data' => [
                'uuid' =>
                    $uuid,

                'account' => [
                    'id' =>
                        (int) $account->id,

                    'code' =>
                        $account->code,

                    'name' =>
                        $account->name,
                ],

                'opening_balance' =>
                    $opening,

                'closing_balance' =>
                    $closing,

                'statement_movement' =>
                    $movement,

                'calculated_closing_balance' =>
                    $calculatedClosing,

                'statement_variance' =>
                    $statementVariance,

                'line_count' =>
                    count(
                        $parsed['lines']
                    ),

                'currency_code' =>
                    $currency,

                'file_contents_stored' =>
                    false,
            ],
        ], 201);
    }

    public function candidates(
        Request $request,
        string $uuid
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $line =
            $this->findLine(
                $tenantId,
                $branchId,
                $uuid
            );

        $date =
            Carbon::parse(
                $line->transaction_date
            );

        $from =
            $date
                ->copy()
                ->subDays(3)
                ->toDateString();

        $to =
            $date
                ->copy()
                ->addDays(3)
                ->toDateString();

        $amount =
            round(
                (float) $line->amount,
                2
            );

        $payments =
            collect();

        if ($amount > 0) {
            $payments =
                DB::table(
                    'pharmaco_payments as payments'
                )
                    ->leftJoin(
                        'pharmaco_pos_sessions as sessions',
                        'sessions.id',
                        '=',
                        'payments.pos_session_id'
                    )
                    ->where(
                        'payments.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'payments.status',
                        'completed'
                    )
                    ->when(
                        $branchId !== null,
                        fn ($query) =>
                            $query->where(
                                'sessions.branch_id',
                                $branchId
                            )
                    )
                    ->whereBetween(
                        'payments.business_date',
                        [
                            $from,
                            $to,
                        ]
                    )
                    ->whereRaw(
                        'ABS(payments.amount - ?) <= 0.01',
                        [
                            $amount,
                        ]
                    )
                    ->whereNotExists(
                        function ($query) use (
                            $tenantId
                        ): void {
                            $query
                                ->selectRaw(
                                    '1'
                                )
                                ->from(
                                    'finance_bank_statement_matches as existing_match'
                                )
                                ->where(
                                    'existing_match.tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'existing_match.match_type',
                                    'payment'
                                )
                                ->whereColumn(
                                    'existing_match.match_id',
                                    'payments.id'
                                );
                        }
                    )
                    ->orderBy(
                        'payments.business_date'
                    )
                    ->limit(
                        50
                    )
                    ->get([
                        'payments.id',
                        'payments.business_date',
                        'payments.amount',
                        'payments.payment_method',
                        'payments.status',
                        'payments.reference_number',
                        'payments.receipt_number',
                    ])
                    ->map(
                        static fn ($row): array => [
                            'match_type' =>
                                'payment',

                            'match_id' =>
                                (int) $row->id,

                            'business_date' =>
                                $row->business_date,

                            'amount' =>
                                (float) $row->amount,

                            'payment_method' =>
                                $row->payment_method,

                            'status' =>
                                $row->status,

                            'reference_number' =>
                                $row->reference_number,

                            'receipt_number' =>
                                $row->receipt_number,
                        ]
                    );
        }

        $journals =
            DB::table(
                'finance_journal_lines as lines'
            )
                ->join(
                    'finance_journal_entries as entries',
                    'entries.id',
                    '=',
                    'lines.journal_entry_id'
                )
                ->where(
                    'entries.tenant_id',
                    $tenantId
                )
                ->where(
                    'lines.chart_of_account_id',
                    (int) $line->chart_of_account_id
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'entries.branch_id',
                            $branchId
                        )
                )
                ->whereBetween(
                    'entries.business_date',
                    [
                        $from,
                        $to,
                    ]
                )
                ->whereRaw(
                    'ABS((lines.debit - lines.credit) - ?) <= 0.01',
                    [
                        $amount,
                    ]
                );

        $journals =
            $this->reportingScope
                ->applyAuthoritative(
                    $journals,
                    $tenantId,
                    'entries',
                    $to
                );

        $journals =
            $journals
                ->whereNotExists(
                    function ($query) use (
                        $tenantId
                    ): void {
                        $query
                            ->selectRaw(
                                '1'
                            )
                            ->from(
                                'finance_bank_statement_matches as existing_match'
                            )
                            ->where(
                                'existing_match.tenant_id',
                                $tenantId
                            )
                            ->where(
                                'existing_match.match_type',
                                'journal_line'
                            )
                            ->whereColumn(
                                'existing_match.match_id',
                                'lines.id'
                            );
                    }
                )
                ->orderBy(
                    'entries.business_date'
                )
                ->limit(
                    50
                )
                ->get([
                    'lines.id',
                    'lines.description',
                    'lines.debit',
                    'lines.credit',

                    'entries.id as journal_entry_id',
                    'entries.journal_number',
                    'entries.business_date',
                ])
                ->map(
                    static fn ($row): array => [
                        'match_type' =>
                            'journal_line',

                        'match_id' =>
                            (int) $row->id,

                        'journal_entry_id' =>
                            (int) $row->journal_entry_id,

                        'journal_number' =>
                            $row->journal_number,

                        'business_date' =>
                            $row->business_date,

                        'amount' =>
                            round(
                                (float) $row->debit
                                -
                                (float) $row->credit,
                                2
                            ),

                        'description' =>
                            $row->description,
                    ]
                );

        return response()->json([
            'statement_line' => [
                'uuid' =>
                    $line->uuid,

                'transaction_date' =>
                    $line->transaction_date,

                'amount' =>
                    $amount,

                'reference' =>
                    $line->reference,

                'description' =>
                    $line->description,
            ],

            'candidate_window' => [
                'from' =>
                    $from,

                'to' =>
                    $to,

                'amount_tolerance' =>
                    0.01,
            ],

            'data' => [
                'payments' =>
                    $payments->values(),

                'journal_lines' =>
                    $journals->values(),
            ],

            'read_only' =>
                true,
        ]);
    }

    public function match(
        Request $request,
        string $uuid
    ): JsonResponse {
        [$tenantId, $branchId, $userId] =
            $this->scope(
                $request
            );

        $validated =
            $request->validate([
                'match_type' => [
                    'required',
                    'in:payment,journal_line',
                ],

                'match_id' => [
                    'required',
                    'integer',
                    'min:1',
                ],

                'notes' => [
                    'nullable',
                    'string',
                    'max:500',
                ],
            ]);

        $line =
            $this->findLine(
                $tenantId,
                $branchId,
                $uuid
            );

        $this->assertImportUnlocked(
            $tenantId,
            (int) $line->statement_import_id
        );

        if (
            DB::table(
                'finance_bank_statement_matches'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_line_id',
                    (int) $line->id
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'match' => [
                    'This bank statement line is already matched.',
                ],
            ]);
        }

        $matchType =
            $validated['match_type'];

        $matchId =
            (int) $validated['match_id'];

        $lineAmount =
            round(
                (float) $line->amount,
                2
            );

        $lineDate =
            Carbon::parse(
                $line->transaction_date
            );

        $from =
            $lineDate
                ->copy()
                ->subDays(3)
                ->toDateString();

        $to =
            $lineDate
                ->copy()
                ->addDays(3)
                ->toDateString();

        if ($matchType === 'payment') {
            if ($lineAmount <= 0) {
                throw ValidationException::withMessages([
                    'match_id' => [
                        'Payments can match positive bank receipts only.',
                    ],
                ]);
            }

            $target =
                DB::table(
                    'pharmaco_payments as payments'
                )
                    ->leftJoin(
                        'pharmaco_pos_sessions as sessions',
                        'sessions.id',
                        '=',
                        'payments.pos_session_id'
                    )
                    ->where(
                        'payments.id',
                        $matchId
                    )
                    ->where(
                        'payments.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'payments.status',
                        'completed'
                    )
                    ->when(
                        $branchId !== null,
                        fn ($query) =>
                            $query->where(
                                'sessions.branch_id',
                                $branchId
                            )
                    )
                    ->whereBetween(
                        'payments.business_date',
                        [
                            $from,
                            $to,
                        ]
                    )
                    ->first([
                        'payments.id',
                        'payments.amount',
                    ]);

            if (
                ! $target
                ||
                abs(
                    (float) $target->amount
                    -
                    $lineAmount
                )
                >
                0.01
            ) {
                throw ValidationException::withMessages([
                    'match_id' => [
                        'The selected completed payment does not match this bank line.',
                    ],
                ]);
            }
        } else {
            $target =
                DB::table(
                    'finance_journal_lines as lines'
                )
                    ->join(
                        'finance_journal_entries as entries',
                        'entries.id',
                        '=',
                        'lines.journal_entry_id'
                    )
                    ->where(
                        'lines.id',
                        $matchId
                    )
                    ->where(
                        'entries.tenant_id',
                        $tenantId
                    )
                    ->where(
                        'lines.chart_of_account_id',
                        (int) $line->chart_of_account_id
                    )
                    ->when(
                        $branchId !== null,
                        fn ($query) =>
                            $query->where(
                                'entries.branch_id',
                                $branchId
                            )
                    )
                    ->whereBetween(
                        'entries.business_date',
                        [
                            $from,
                            $to,
                        ]
                    );

            $target =
                $this->reportingScope
                    ->applyAuthoritative(
                        $target,
                        $tenantId,
                        'entries',
                        $to
                    )
                    ->first([
                        'lines.id',
                        'lines.debit',
                        'lines.credit',
                    ]);

            if (! $target) {
                throw ValidationException::withMessages([
                    'match_id' => [
                        'The selected journal line is not an authoritative posted bank-account line.',
                    ],
                ]);
            }

            $journalAmount =
                round(
                    (float) $target->debit
                    -
                    (float) $target->credit,
                    2
                );

            if (
                abs(
                    $journalAmount
                    -
                    $lineAmount
                )
                >
                0.01
            ) {
                throw ValidationException::withMessages([
                    'match_id' => [
                        'The selected journal amount does not match this bank line.',
                    ],
                ]);
            }
        }

        if (
            DB::table(
                'finance_bank_statement_matches'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'match_type',
                    $matchType
                )
                ->where(
                    'match_id',
                    $matchId
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'match_id' => [
                    'This Finance transaction is already reconciled to another bank line.',
                ],
            ]);
        }

        $matchUuid =
            (string) Str::uuid();

        DB::table(
            'finance_bank_statement_matches'
        )
            ->insert([
                'uuid' =>
                    $matchUuid,

                'tenant_id' =>
                    $tenantId,

                'branch_id' =>
                    $branchId,

                'statement_line_id' =>
                    (int) $line->id,

                'match_type' =>
                    $matchType,

                'match_id' =>
                    $matchId,

                'matched_amount' =>
                    $lineAmount,

                'match_method' =>
                    'manual',

                'notes' =>
                    $validated['notes']
                    ??
                    null,

                'matched_by' =>
                    $userId,

                'matched_at' =>
                    now(),

                'created_at' =>
                    now(),

                'updated_at' =>
                    now(),
            ]);

        return response()->json([
            'message' =>
                'Bank statement line matched.',

            'data' => [
                'uuid' =>
                    $matchUuid,

                'statement_line_uuid' =>
                    $line->uuid,

                'match_type' =>
                    $matchType,

                'match_id' =>
                    $matchId,

                'matched_amount' =>
                    $lineAmount,
            ],
        ], 201);
    }

    public function unmatch(
        Request $request,
        string $uuid
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $line =
            $this->findLine(
                $tenantId,
                $branchId,
                $uuid
            );

        $this->assertImportUnlocked(
            $tenantId,
            (int) $line->statement_import_id
        );

        $deleted =
            DB::table(
                'finance_bank_statement_matches'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_line_id',
                    (int) $line->id
                )
                ->delete();

        if ($deleted === 0) {
            return response()->json([
                'message' =>
                    'This statement line is not matched.',
            ], 404);
        }

        return response()->json([
            'message' =>
                'Bank statement line unmatched.',
        ]);
    }

    public function sessions(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId] =
            $this->scope(
                $request
            );

        $rows =
            DB::table(
                'finance_bank_reconciliation_sessions as sessions'
            )
                ->join(
                    'finance_bank_statement_imports as imports',
                    'imports.id',
                    '=',
                    'sessions.statement_import_id'
                )
                ->leftJoin(
                    'finance_chart_of_accounts as accounts',
                    'accounts.id',
                    '=',
                    'sessions.chart_of_account_id'
                )
                ->where(
                    'sessions.tenant_id',
                    $tenantId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'sessions.branch_id',
                            $branchId
                        )
                )
                ->orderByDesc(
                    'sessions.id'
                )
                ->limit(
                    100
                )
                ->get([
                    'sessions.id',
                    'sessions.uuid',
                    'sessions.statement_import_id',
                    'sessions.chart_of_account_id',
                    'sessions.period_from',
                    'sessions.period_to',
                    'sessions.statement_opening_balance',
                    'sessions.statement_closing_balance',
                    'sessions.book_closing_balance',
                    'sessions.difference',
                    'sessions.status',
                    'sessions.locked_at',

                    'imports.uuid as import_uuid',
                    'imports.statement_variance',

                    'accounts.code as account_code',
                    'accounts.name as account_name',
                ]);

        $data =
            $rows
                ->map(
                    function ($row) use (
                        $tenantId
                    ): array {
                        $lineCount =
                            DB::table(
                                'finance_bank_statement_lines'
                            )
                                ->where(
                                    'tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'statement_import_id',
                                    $row->statement_import_id
                                )
                                ->count();

                        $matchedCount =
                            DB::table(
                                'finance_bank_statement_matches as matches'
                            )
                                ->join(
                                    'finance_bank_statement_lines as lines',
                                    'lines.id',
                                    '=',
                                    'matches.statement_line_id'
                                )
                                ->where(
                                    'matches.tenant_id',
                                    $tenantId
                                )
                                ->where(
                                    'lines.statement_import_id',
                                    $row->statement_import_id
                                )
                                ->count();

                        return [
                            'uuid' =>
                                $row->uuid,

                            'import_uuid' =>
                                $row->import_uuid,

                            'chart_of_account_id' =>
                                (int) $row->chart_of_account_id,

                            'account_code' =>
                                $row->account_code,

                            'account_name' =>
                                $row->account_name,

                            'period_from' =>
                                $row->period_from,

                            'period_to' =>
                                $row->period_to,

                            'statement_opening_balance' =>
                                (float) $row->statement_opening_balance,

                            'statement_closing_balance' =>
                                (float) $row->statement_closing_balance,

                            'book_closing_balance' =>
                                (float) $row->book_closing_balance,

                            'difference' =>
                                (float) $row->difference,

                            'statement_variance' =>
                                (float) $row->statement_variance,

                            'status' =>
                                $row->status,

                            'line_count' =>
                                (int) $lineCount,

                            'matched_count' =>
                                (int) $matchedCount,

                            'unmatched_count' =>
                                max(
                                    0,
                                    (int) $lineCount
                                    -
                                    (int) $matchedCount
                                ),

                            'locked_at' =>
                                $row->locked_at,
                        ];
                    }
                )
                ->values();

        return response()->json([
            'data' =>
                $data,

            'read_only' =>
                true,
        ]);
    }

    public function createSession(
        Request $request
    ): JsonResponse {
        [$tenantId, $branchId, $userId] =
            $this->scope(
                $request
            );

        $validated =
            $request->validate([
                'import_uuid' => [
                    'required',
                    'string',
                    'max:36',
                ],
            ]);

        $import =
            $this->findImport(
                $tenantId,
                $branchId,
                $validated['import_uuid']
            );

        if (
            DB::table(
                'finance_bank_reconciliation_sessions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_import_id',
                    (int) $import->id
                )
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'import_uuid' => [
                    'A reconciliation session already exists for this statement.',
                ],
            ]);
        }

        $bookBalance =
            $this->bookBalance(
                $tenantId,
                $branchId,
                (int) $import->chart_of_account_id,
                $import->statement_to
            );

        $difference =
            round(
                (float) $import->closing_balance
                -
                $bookBalance,
                2
            );

        $uuid =
            (string) Str::uuid();

        DB::transaction(
            function () use (
                $tenantId,
                $branchId,
                $userId,
                $import,
                $bookBalance,
                $difference,
                $uuid
            ): void {
                DB::table(
                    'finance_bank_reconciliation_sessions'
                )
                    ->insert([
                        'uuid' =>
                            $uuid,

                        'tenant_id' =>
                            $tenantId,

                        'branch_id' =>
                            $branchId,

                        'statement_import_id' =>
                            (int) $import->id,

                        'chart_of_account_id' =>
                            (int) $import->chart_of_account_id,

                        'period_from' =>
                            $import->statement_from,

                        'period_to' =>
                            $import->statement_to,

                        'statement_opening_balance' =>
                            (float) $import->opening_balance,

                        'statement_closing_balance' =>
                            (float) $import->closing_balance,

                        'book_closing_balance' =>
                            $bookBalance,

                        'difference' =>
                            $difference,

                        'status' =>
                            'open',

                        'created_by' =>
                            $userId,

                        'created_at' =>
                            now(),

                        'updated_at' =>
                            now(),
                    ]);

                DB::table(
                    'finance_bank_statement_imports'
                )
                    ->where(
                        'id',
                        (int) $import->id
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->update([
                        'status' =>
                            'reconciling',

                        'updated_at' =>
                            now(),
                    ]);
            }
        );

        return response()->json([
            'message' =>
                'Bank reconciliation session opened.',

            'data' => [
                'uuid' =>
                    $uuid,

                'import_uuid' =>
                    $import->uuid,

                'statement_closing_balance' =>
                    (float) $import->closing_balance,

                'book_closing_balance' =>
                    $bookBalance,

                'difference' =>
                    $difference,

                'status' =>
                    'open',
            ],
        ], 201);
    }

    public function lockSession(
        Request $request,
        string $uuid
    ): JsonResponse {
        [$tenantId, $branchId, $userId] =
            $this->scope(
                $request
            );

        $session =
            DB::table(
                'finance_bank_reconciliation_sessions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $uuid
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->first();

        if (! $session) {
            throw new HttpException(
                404,
                'Bank reconciliation session not found.'
            );
        }

        if (
            $session->status ===
            'locked'
        ) {
            return response()->json([
                'message' =>
                    'This reconciliation is already locked.',
            ], 409);
        }

        $import =
            DB::table(
                'finance_bank_statement_imports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'id',
                    (int) $session->statement_import_id
                )
                ->first();

        if (! $import) {
            throw ValidationException::withMessages([
                'reconciliation' => [
                    'The source bank statement is unavailable.',
                ],
            ]);
        }

        $lineCount =
            DB::table(
                'finance_bank_statement_lines'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_import_id',
                    (int) $import->id
                )
                ->count();

        $matchedCount =
            DB::table(
                'finance_bank_statement_matches as matches'
            )
                ->join(
                    'finance_bank_statement_lines as lines',
                    'lines.id',
                    '=',
                    'matches.statement_line_id'
                )
                ->where(
                    'matches.tenant_id',
                    $tenantId
                )
                ->where(
                    'lines.statement_import_id',
                    (int) $import->id
                )
                ->count();

        $unmatched =
            max(
                0,
                (int) $lineCount
                -
                (int) $matchedCount
            );

        if ($unmatched > 0) {
            throw ValidationException::withMessages([
                'reconciliation' => [
                    'All bank statement lines must be matched before locking. '
                    . $unmatched
                    . ' line(s) remain unmatched.',
                ],
            ]);
        }

        if (
            abs(
                (float) $import->statement_variance
            )
            >
            0.01
        ) {
            throw ValidationException::withMessages([
                'reconciliation' => [
                    'The statement opening balance plus movements does not equal its closing balance.',
                ],
            ]);
        }

        $bookBalance =
            $this->bookBalance(
                $tenantId,
                $branchId,
                (int) $session->chart_of_account_id,
                $session->period_to
            );

        $difference =
            round(
                (float) $session->statement_closing_balance
                -
                $bookBalance,
                2
            );

        if (
            abs(
                $difference
            )
            >
            0.01
        ) {
            throw ValidationException::withMessages([
                'reconciliation' => [
                    'Statement and authoritative Finance ledger do not agree. Difference: '
                    . number_format(
                        $difference,
                        2,
                        '.',
                        ''
                    ),
                ],
            ]);
        }

        DB::transaction(
            function () use (
                $tenantId,
                $userId,
                $session,
                $bookBalance,
                $difference
            ): void {
                $updated =
                    DB::table(
                        'finance_bank_reconciliation_sessions'
                    )
                        ->where(
                            'id',
                            (int) $session->id
                        )
                        ->where(
                            'tenant_id',
                            $tenantId
                        )
                        ->where(
                            'status',
                            'open'
                        )
                        ->update([
                            'book_closing_balance' =>
                                $bookBalance,

                            'difference' =>
                                $difference,

                            'status' =>
                                'locked',

                            'locked_by' =>
                                $userId,

                            'locked_at' =>
                                now(),

                            'updated_at' =>
                                now(),
                        ]);

                if ($updated !== 1) {
                    throw ValidationException::withMessages([
                        'reconciliation' => [
                            'The reconciliation changed before it could be locked.',
                        ],
                    ]);
                }

                DB::table(
                    'finance_bank_statement_imports'
                )
                    ->where(
                        'id',
                        (int) $session->statement_import_id
                    )
                    ->where(
                        'tenant_id',
                        $tenantId
                    )
                    ->update([
                        'status' =>
                            'reconciled',

                        'updated_at' =>
                            now(),
                    ]);
            }
        );

        return response()->json([
            'message' =>
                'Bank reconciliation locked.',

            'data' => [
                'uuid' =>
                    $uuid,

                'statement_closing_balance' =>
                    (float) $session->statement_closing_balance,

                'book_closing_balance' =>
                    $bookBalance,

                'difference' =>
                    $difference,

                'matched_count' =>
                    (int) $matchedCount,

                'status' =>
                    'locked',
            ],
        ]);
    }

    private function scope(
        Request $request
    ): array {
        $scope =
            $this->requestScope
                ->resolve(
                    $request
                );

        return [
            (int) $scope['tenant_id'],

            $scope['branch_id'] !== null
                ? (int) $scope['branch_id']
                : null,

            (int) $scope['user_id'],
        ];
    }

    private function findImport(
        int $tenantId,
        ?int $branchId,
        string $uuid
    ): object {
        $row =
            DB::table(
                'finance_bank_statement_imports'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $uuid
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->first();

        if (! $row) {
            throw new HttpException(
                404,
                'Bank statement import not found.'
            );
        }

        return $row;
    }

    private function findLine(
        int $tenantId,
        ?int $branchId,
        string $uuid
    ): object {
        $row =
            DB::table(
                'finance_bank_statement_lines'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'uuid',
                    $uuid
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'branch_id',
                            $branchId
                        )
                )
                ->first();

        if (! $row) {
            throw new HttpException(
                404,
                'Bank statement line not found.'
            );
        }

        return $row;
    }

    private function assertImportUnlocked(
        int $tenantId,
        int $statementImportId
    ): void {
        $locked =
            DB::table(
                'finance_bank_reconciliation_sessions'
            )
                ->where(
                    'tenant_id',
                    $tenantId
                )
                ->where(
                    'statement_import_id',
                    $statementImportId
                )
                ->where(
                    'status',
                    'locked'
                )
                ->exists();

        if ($locked) {
            throw ValidationException::withMessages([
                'reconciliation' => [
                    'This bank statement belongs to a locked reconciliation.',
                ],
            ]);
        }
    }

    private function bookBalance(
        int $tenantId,
        ?int $branchId,
        int $chartOfAccountId,
        string $asOf
    ): float {
        $query =
            DB::table(
                'finance_journal_lines as lines'
            )
                ->join(
                    'finance_journal_entries as entries',
                    'entries.id',
                    '=',
                    'lines.journal_entry_id'
                )
                ->where(
                    'entries.tenant_id',
                    $tenantId
                )
                ->where(
                    'lines.chart_of_account_id',
                    $chartOfAccountId
                )
                ->when(
                    $branchId !== null,
                    fn ($query) =>
                        $query->where(
                            'entries.branch_id',
                            $branchId
                        )
                )
                ->whereDate(
                    'entries.business_date',
                    '<=',
                    $asOf
                );

        $query =
            $this->reportingScope
                ->applyAuthoritative(
                    $query,
                    $tenantId,
                    'entries',
                    $asOf
                );

        $row =
            $query
                ->selectRaw(
                    'COALESCE(SUM(lines.debit),0) as debit, '
                    . 'COALESCE(SUM(lines.credit),0) as credit'
                )
                ->first();

        return round(
            (float) (
                $row->debit
                ??
                0
            )
            -
            (float) (
                $row->credit
                ??
                0
            ),
            2
        );
    }

    private function parseStatement(
        string $path,
        string $statementFrom,
        string $statementTo
    ): array {
        $handle =
            fopen(
                $path,
                'rb'
            );

        if (! $handle) {
            throw ValidationException::withMessages([
                'statement' => [
                    'The bank statement could not be opened.',
                ],
            ]);
        }

        try {
            $rawHeader =
                fgetcsv(
                    $handle
                );

            if (
                ! is_array(
                    $rawHeader
                )
                ||
                $rawHeader === []
            ) {
                throw ValidationException::withMessages([
                    'statement' => [
                        'The CSV has no header row.',
                    ],
                ]);
            }

            $headers =
                array_map(
                    fn ($value) =>
                        $this->normaliseHeader(
                            (string) $value
                        ),
                    $rawHeader
                );

            $dateIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'date',
                        'transaction_date',
                        'transactiondate',
                        'value_date',
                        'posted_date',
                    ]
                );

            $descriptionIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'description',
                        'details',
                        'narrative',
                        'memo',
                    ],
                    false
                );

            $referenceIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'reference',
                        'ref',
                        'transaction_id',
                        'transaction_reference',
                    ],
                    false
                );

            $amountIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'amount',
                    ],
                    false
                );

            $debitIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'debit',
                        'withdrawal',
                        'withdrawals',
                    ],
                    false
                );

            $creditIndex =
                $this->headerIndex(
                    $headers,
                    [
                        'credit',
                        'deposit',
                        'deposits',
                    ],
                    false
                );

            if (
                $amountIndex === null
                &&
                (
                    $debitIndex === null
                    ||
                    $creditIndex === null
                )
            ) {
                throw ValidationException::withMessages([
                    'statement' => [
                        'CSV requires Amount or both Debit and Credit columns.',
                    ],
                ]);
            }

            $lines = [];
            $movement = 0.0;
            $csvLine = 1;

            while (
                (
                    $row =
                        fgetcsv(
                            $handle
                        )
                )
                !==
                false
            ) {
                $csvLine++;

                if (! is_array($row)) {
                    continue;
                }

                $hasValue =
                    collect(
                        $row
                    )
                        ->contains(
                            fn ($value) =>
                                trim(
                                    (string) $value
                                )
                                !==
                                ''
                        );

                if (! $hasValue) {
                    continue;
                }

                $rawDate =
                    (string) (
                        $row[$dateIndex]
                        ??
                        ''
                    );

                $date =
                    $this->parseStatementDate(
                        $rawDate,
                        $csvLine
                    );

                if (
                    $date < $statementFrom
                    ||
                    $date > $statementTo
                ) {
                    throw ValidationException::withMessages([
                        'statement' => [
                            'CSV line '
                            . $csvLine
                            . ' is outside the statement period.',
                        ],
                    ]);
                }

                if ($amountIndex !== null) {
                    $amount =
                        $this->parseNumber(
                            $row[$amountIndex]
                            ??
                            null
                        );
                } else {
                    $debit =
                        $this->parseNumber(
                            $row[$debitIndex]
                            ??
                            null
                        );

                    $credit =
                        $this->parseNumber(
                            $row[$creditIndex]
                            ??
                            null
                        );

                    $amount =
                        $credit
                        -
                        $debit;
                }

                $amount =
                    round(
                        $amount,
                        2
                    );

                if (
                    abs(
                        $amount
                    )
                    <
                    0.005
                ) {
                    throw ValidationException::withMessages([
                        'statement' => [
                            'CSV line '
                            . $csvLine
                            . ' has a zero amount.',
                        ],
                    ]);
                }

                $reference =
                    $referenceIndex !== null
                        ? trim(
                            (string) (
                                $row[
                                    $referenceIndex
                                ]
                                ??
                                ''
                            )
                        )
                        : '';

                if ($reference === '') {
                    $reference =
                        null;
                }

                if (
                    $reference !== null
                    &&
                    mb_strlen(
                        $reference
                    )
                    >
                    100
                ) {
                    $reference =
                        mb_substr(
                            $reference,
                            0,
                            100
                        );
                }

                $description =
                    $descriptionIndex !== null
                        ? trim(
                            (string) (
                                $row[
                                    $descriptionIndex
                                ]
                                ??
                                ''
                            )
                        )
                        : '';

                $lines[] = [
                    'line_number' =>
                        $csvLine,

                    'transaction_date' =>
                        $date,

                    'reference' =>
                        $reference,

                    'description' =>
                        $description !== ''
                            ? $description
                            : null,

                    'amount' =>
                        $amount,
                ];

                $movement +=
                    $amount;
            }

            if ($lines === []) {
                throw ValidationException::withMessages([
                    'statement' => [
                        'The bank statement contains no transaction rows.',
                    ],
                ]);
            }

            return [
                'lines' =>
                    $lines,

                'movement' =>
                    round(
                        $movement,
                        2
                    ),
            ];
        } finally {
            fclose(
                $handle
            );
        }
    }

    private function normaliseHeader(
        string $value
    ): string {
        $value =
            preg_replace(
                '/^\xEF\xBB\xBF/',
                '',
                $value
            );

        $value =
            strtolower(
                trim(
                    $value
                )
            );

        $value =
            preg_replace(
                '/[^a-z0-9]+/',
                '_',
                $value
            );

        return trim(
            (string) $value,
            '_'
        );
    }

    private function headerIndex(
        array $headers,
        array $aliases,
        bool $required = true
    ): ?int {
        foreach (
            $aliases
            as
            $alias
        ) {
            $index =
                array_search(
                    $alias,
                    $headers,
                    true
                );

            if ($index !== false) {
                return (int) $index;
            }
        }

        if ($required) {
            throw ValidationException::withMessages([
                'statement' => [
                    'Required CSV column missing: '
                    . implode(
                        ' / ',
                        $aliases
                    ),
                ],
            ]);
        }

        return null;
    }

    private function parseNumber(
        mixed $value
    ): float {
        if ($value === null) {
            return 0.0;
        }

        $text =
            trim(
                (string) $value
            );

        if ($text === '') {
            return 0.0;
        }

        $parenthesesNegative =
            str_starts_with(
                $text,
                '('
            )
            &&
            str_ends_with(
                $text,
                ')'
            );

        $clean =
            preg_replace(
                '/[^0-9.\-]/',
                '',
                $text
            );

        if (
            $clean === ''
            ||
            $clean === '-'
            ||
            ! is_numeric(
                $clean
            )
        ) {
            throw ValidationException::withMessages([
                'statement' => [
                    'Invalid amount: '
                    . $text,
                ],
            ]);
        }

        $number =
            (float) $clean;

        if ($parenthesesNegative) {
            $number =
                -abs(
                    $number
                );
        }

        return $number;
    }

    private function parseStatementDate(
        string $value,
        int $lineNumber
    ): string {
        $value =
            trim(
                $value
            );

        $formats = [
            'Y-m-d',
            'Y/m/d',
            'd/m/Y',
            'd-m-Y',
            'm/d/Y',
        ];

        foreach (
            $formats
            as
            $format
        ) {
            try {
                $date =
                    Carbon::createFromFormat(
                        $format,
                        $value
                    );

                if (
                    $date
                    &&
                    $date->format(
                        $format
                    )
                    ===
                    $value
                ) {
                    return $date
                        ->toDateString();
                }
            } catch (\Throwable) {
                //
            }
        }

        throw ValidationException::withMessages([
            'statement' => [
                'CSV line '
                . $lineNumber
                . ' has unsupported date: '
                . $value,
            ],
        ]);
    }
}
