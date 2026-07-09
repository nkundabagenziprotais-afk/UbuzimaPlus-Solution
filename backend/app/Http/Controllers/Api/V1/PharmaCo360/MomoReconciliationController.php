<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\PharmacoMomoMessage;
use App\Models\PharmacoMomoParserTemplate;
use App\Models\PharmacoMomoReconciliation;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\Payments\MomoMessageParser;
use App\Services\Payments\MomoReconciliationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MomoReconciliationController extends Controller
{
    public function templates(
        Request $request
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        $templates =
            PharmacoMomoParserTemplate::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->latest('version')
                ->get();

        if ($templates->isEmpty()) {
            $templates = collect([
                $this->defaultTemplate(
                    $tenant->id,
                    $request->user()?->id
                ),
            ]);
        }

        return response()->json([
            'templates' =>
                $templates
                    ->map(
                        fn (
                            PharmacoMomoParserTemplate
                            $template
                        ) =>
                            $this->serializeTemplate(
                                $template
                            )
                    )
                    ->values(),
        ]);
    }

    public function storeTemplate(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:191',
            ],
            'sender_id' => [
                'required',
                'string',
                'max:100',
            ],
            'message_regex' => [
                'required',
                'string',
                'max:5000',
            ],
            'timezone' => [
                'nullable',
                'timezone',
            ],
            'sample_message' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        set_error_handler(
            static fn () => true
        );

        try {
            $regexValid =
                preg_match(
                    $validated['message_regex'],
                    ''
                ) !== false;
        } finally {
            restore_error_handler();
        }

        if (! $regexValid) {
            throw ValidationException::withMessages([
                'message_regex' => [
                    'The parser expression is not a valid regular expression.',
                ],
            ]);
        }

        PharmacoMomoParserTemplate::query()
            ->where(
                'tenant_id',
                $tenant->id
            )
            ->where(
                'sender_id',
                $validated['sender_id']
            )
            ->update([
                'status' => 'inactive',
                'updated_by' =>
                    $request->user()?->id,
            ]);

        $version =
            (int) PharmacoMomoParserTemplate::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'sender_id',
                    $validated['sender_id']
                )
                ->max('version') + 1;

        $template =
            PharmacoMomoParserTemplate::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'name' =>
                        $validated['name'],
                    'sender_id' =>
                        $validated['sender_id'],
                    'version' => max(1, $version),
                    'status' => 'active',
                    'message_regex' =>
                        $validated['message_regex'],
                    'timezone' =>
                        $validated['timezone']
                            ?? 'Africa/Kigali',
                    'sample_message' =>
                        $validated['sample_message']
                            ?? null,
                    'metadata' => [
                        'required_named_groups' => [
                            'amount',
                            'currency',
                            'customer',
                            'phone',
                            'datetime',
                            'balance',
                            'transaction_id',
                            'et_id',
                        ],
                    ],
                    'created_by' =>
                        $request->user()?->id,
                    'updated_by' =>
                        $request->user()?->id,
                ]);

        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );

        $auditLogService->record(
            action:
                'pharmaco.momo.parser_template.created',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'template_id' => $template->id,
                'sender_id' =>
                    $template->sender_id,
                'version' =>
                    $template->version,
            ],
            dataClassification: 'internal',
            auditableType:
                PharmacoMomoParserTemplate::class,
            auditableId: $template->id
        );

        return response()->json([
            'message' =>
                'Mobile Money parser template saved.',
            'template' =>
                $this->serializeTemplate(
                    $template
                ),
        ], 201);
    }

    public function messages(
        Request $request
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        $messages =
            PharmacoMomoMessage::query()
                ->with('reconciliation')
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->latest('transaction_at')
                ->latest('received_at')
                ->limit(500)
                ->get();

        return response()->json([
            'messages' =>
                $messages
                    ->map(
                        fn (
                            PharmacoMomoMessage
                            $message
                        ) =>
                            $this->serializeMessage(
                                $message
                            )
                    )
                    ->values(),
        ]);
    }

    public function ingest(
        Request $request,
        MomoMessageParser $parser,
        MomoReconciliationEngine $engine,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        $validated = $request->validate([
            'sender_id' => [
                'required',
                'string',
                'max:100',
            ],
            'message_body' => [
                'required',
                'string',
                'max:10000',
            ],
            'received_at' => [
                'nullable',
                'date',
            ],
            'device_uuid' => [
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        $template =
            PharmacoMomoParserTemplate::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'sender_id',
                    $validated['sender_id']
                )
                ->where(
                    'status',
                    'active'
                )
                ->latest('version')
                ->first();

        if (! $template) {
            $template = $this->defaultTemplate(
                $tenant->id,
                $request->user()?->id,
                $validated['sender_id']
            );
        }

        $hash = hash(
            'sha256',
            implode('|', [
                $tenant->id,
                strtolower(
                    $validated['sender_id']
                ),
                trim(
                    $validated['message_body']
                ),
            ])
        );

        $existing =
            PharmacoMomoMessage::query()
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->where(
                    'duplicate_hash',
                    $hash
                )
                ->first();

        if ($existing) {
            $existing->load('reconciliation');

            return response()->json([
                'message' =>
                    'This Mobile Money message was already recorded.',
                'momo_message' =>
                    $this->serializeMessage(
                        $existing
                    ),
            ]);
        }

        $parsed = $parser->parse(
            $template,
            $validated['message_body']
        );

        $data = $parsed['data'];

        $message =
            PharmacoMomoMessage::query()
                ->create([
                    'uuid' =>
                        (string) Str::uuid(),
                    'tenant_id' =>
                        $tenant->id,
                    'parser_template_id' =>
                        $template->id,
                    'device_uuid' =>
                        $validated['device_uuid']
                            ?? null,
                    'sender_id' =>
                        $validated['sender_id'],
                    'raw_message' =>
                        $validated['message_body'],
                    'received_at' =>
                        $validated['received_at']
                            ?? now(),
                    'transaction_at' =>
                        $data['transaction_at']
                            ?? null,
                    'customer_name' =>
                        $data['customer_name']
                            ?? null,
                    'phone_masked' =>
                        $data['phone_masked']
                            ?? null,
                    'phone_suffix' =>
                        $data['phone_suffix']
                            ?? null,
                    'amount' =>
                        $data['amount']
                            ?? null,
                    'currency' =>
                        $data['currency']
                            ?? null,
                    'provider_transaction_id' =>
                        $data[
                            'provider_transaction_id'
                        ] ?? null,
                    'balance' =>
                        $data['balance']
                            ?? null,
                    'et_id' =>
                        $data['et_id']
                            ?? null,
                    'parse_status' =>
                        $parsed['status'],
                    'parse_confidence' =>
                        $parsed['confidence'],
                    'duplicate_hash' => $hash,
                    'parse_errors' =>
                        $parsed['errors'],
                    'metadata' => [
                        'ingestion_channel' =>
                            $validated['device_uuid']
                                ? 'android_sms_collector'
                                : 'manual_or_api_import',
                    ],
                ]);

        if (
            in_array(
                $message->parse_status,
                ['parsed', 'partial'],
                true
            )
        ) {
            $engine->reconcileMessage($message);
        }

        $message->load('reconciliation');

        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );

        $auditLogService->record(
            action:
                'pharmaco.momo.message.ingested',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'momo_message_id' =>
                    $message->id,
                'sender_id' =>
                    $message->sender_id,
                'parse_status' =>
                    $message->parse_status,
                'transaction_id' =>
                    $message
                        ->provider_transaction_id,
            ],
            dataClassification: 'confidential',
            auditableType:
                PharmacoMomoMessage::class,
            auditableId: $message->id
        );

        return response()->json([
            'message' =>
                'Mobile Money message processed.',
            'momo_message' =>
                $this->serializeMessage(
                    $message
                ),
        ], 201);
    }

    public function reconciliations(
        Request $request,
        MomoReconciliationEngine $engine
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        $engine->synchronizePosExceptions(
            $tenant->id
        );

        $reconciliations =
            PharmacoMomoReconciliation::query()
                ->with([
                    'message',
                    'payment',
                    'sale.customer',
                ])
                ->where(
                    'tenant_id',
                    $tenant->id
                )
                ->latest()
                ->limit(500)
                ->get();

        return response()->json([
            'reconciliations' =>
                $reconciliations
                    ->map(
                        fn (
                            PharmacoMomoReconciliation
                            $reconciliation
                        ) =>
                            $this
                                ->serializeReconciliation(
                                    $reconciliation
                                )
                    )
                    ->values(),
        ]);
    }

    public function approve(
        Request $request,
        PharmacoMomoReconciliation
            $reconciliation,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        if (
            (int) $reconciliation->tenant_id
            !== (int) $tenant->id
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'decision' => [
                'required',
                'string',
                'in:matched_manually,accepted_pos_only,accepted_momo_only,ignored',
            ],
            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $reconciliation->fill([
            'status' => 'approved',
            'decision' =>
                $validated['decision'],
            'reviewed_by' =>
                $request->user()?->id,
            'reviewed_at' => now(),
            'review_notes' =>
                $validated['notes']
                    ?? null,
        ]);

        $reconciliation->save();
        $reconciliation->load([
            'message',
            'payment',
            'sale.customer',
        ]);

        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );

        $auditLogService->record(
            action:
                'pharmaco.momo.reconciliation.approved',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'reconciliation_id' =>
                    $reconciliation->id,
                'decision' =>
                    $reconciliation->decision,
            ],
            dataClassification: 'confidential',
            auditableType:
                PharmacoMomoReconciliation::class,
            auditableId:
                $reconciliation->id
        );

        return response()->json([
            'message' =>
                'Mobile Money reconciliation decision approved.',
            'reconciliation' =>
                $this->serializeReconciliation(
                    $reconciliation
                ),
        ]);
    }

    public function reject(
        Request $request,
        PharmacoMomoReconciliation
            $reconciliation,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $tenant =
            $request->attributes->get('tenant');

        if (
            (int) $reconciliation->tenant_id
            !== (int) $tenant->id
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'notes' => [
                'required',
                'string',
                'max:2000',
            ],
        ]);

        $reconciliation->fill([
            'status' => 'rejected',
            'decision' =>
                'rejected_or_ignored',
            'reviewed_by' =>
                $request->user()?->id,
            'reviewed_at' => now(),
            'review_notes' =>
                $validated['notes'],
        ]);

        $reconciliation->save();

        $scope =
            $scopeResolver->resolveForUser(
                $request->user()
            );

        $auditLogService->record(
            action:
                'pharmaco.momo.reconciliation.rejected',
            scope: $scope,
            metadata: [
                'tenant_slug' => $tenant->slug,
                'reconciliation_id' =>
                    $reconciliation->id,
            ],
            dataClassification: 'confidential',
            auditableType:
                PharmacoMomoReconciliation::class,
            auditableId:
                $reconciliation->id
        );

        return response()->json([
            'message' =>
                'Mobile Money reconciliation decision rejected.',
        ]);
    }

    private function defaultTemplate(
        int $tenantId,
        ?int $userId,
        string $senderId = 'M-Money'
    ): PharmacoMomoParserTemplate {
        return PharmacoMomoParserTemplate::query()
            ->firstOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'sender_id' => $senderId,
                    'version' => 1,
                ],
                [
                    'uuid' =>
                        (string) Str::uuid(),
                    'name' =>
                        'Standard Mobile Money Receipt',
                    'status' => 'active',
                    'message_regex' =>
                        MomoMessageParser::defaultRegex(),
                    'timezone' =>
                        'Africa/Kigali',
                    'sample_message' =>
                        'You have received 213200 RWF from VITA PHARMA Ltd Ltd (*********980) at 2026-07-09 08:13:20. Balance: 444607 RWF. FT Id: 29074382317. ET Id: -.',
                    'metadata' => [
                        'source' =>
                            'system_default',
                    ],
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]
            );
    }

    private function serializeTemplate(
        PharmacoMomoParserTemplate $template
    ): array {
        return [
            'id' => $template->id,
            'uuid' => $template->uuid,
            'name' => $template->name,
            'sender_id' => $template->sender_id,
            'version' => $template->version,
            'status' => $template->status,
            'message_regex' =>
                $template->message_regex,
            'timezone' => $template->timezone,
            'sample_message' =>
                $template->sample_message,
            'created_at' =>
                $template->created_at?->toISOString(),
        ];
    }

    private function serializeMessage(
        PharmacoMomoMessage $message
    ): array {
        return [
            'id' => $message->id,
            'uuid' => $message->uuid,
            'sender_id' => $message->sender_id,
            'received_at' =>
                $message->received_at?->toISOString(),
            'transaction_at' =>
                $message
                    ->transaction_at
                    ?->toISOString(),
            'customer_name' =>
                $message->customer_name,
            'phone_masked' =>
                $message->phone_masked,
            'amount' =>
                $message->amount !== null
                    ? (float) $message->amount
                    : null,
            'currency' => $message->currency,
            'provider_transaction_id' =>
                $message
                    ->provider_transaction_id,
            'balance' =>
                $message->balance !== null
                    ? (float) $message->balance
                    : null,
            'et_id' => $message->et_id,
            'parse_status' =>
                $message->parse_status,
            'parse_confidence' =>
                (float) $message
                    ->parse_confidence,
            'ingestion_channel' =>
                $message->metadata[
                    'ingestion_channel'
                ] ?? null,
            'reconciliation_status' =>
                $message->reconciliation?->status,
            'reconciliation_decision' =>
                $message
                    ->reconciliation
                    ?->decision,
        ];
    }

    private function serializeReconciliation(
        PharmacoMomoReconciliation
            $reconciliation
    ): array {
        $sale = $reconciliation->sale;
        $customer = $sale?->customer;

        return [
            'id' => $reconciliation->id,
            'uuid' => $reconciliation->uuid,
            'status' =>
                $reconciliation->status,
            'decision' =>
                $reconciliation->decision,
            'confidence_score' =>
                (float) $reconciliation
                    ->confidence_score,
            'amount_variance' =>
                $reconciliation
                    ->amount_variance !== null
                    ? (float) $reconciliation
                        ->amount_variance
                    : null,
            'matching_reasons' =>
                $reconciliation
                    ->matching_reasons ?? [],
            'reviewed_at' =>
                $reconciliation
                    ->reviewed_at
                    ?->toISOString(),
            'review_notes' =>
                $reconciliation
                    ->review_notes,
            'momo_message' =>
                $reconciliation->message
                    ? $this->serializeMessage(
                        $reconciliation->message
                    )
                    : null,
            'pos_payment' =>
                $reconciliation->payment
                    ? [
                        'id' =>
                            $reconciliation
                                ->payment->id,
                        'receipt_number' =>
                            $reconciliation
                                ->payment
                                ->receipt_number,
                        'payment_method' =>
                            $reconciliation
                                ->payment
                                ->payment_method,
                        'amount' =>
                            (float)
                            $reconciliation
                                ->payment->amount,
                        'reference_number' =>
                            $reconciliation
                                ->payment
                                ->reference_number,
                        'status' =>
                            $reconciliation
                                ->payment->status,
                        'received_at' =>
                            $reconciliation
                                ->payment
                                ->received_at
                                ?->toISOString(),
                    ]
                    : null,
            'sale' =>
                $sale
                    ? [
                        'id' => $sale->id,
                        'sale_number' =>
                            $sale->sale_number,
                        'sold_at' =>
                            $sale->sold_at
                                ?->toISOString(),
                        'customer_name' =>
                            $customer?->full_name
                            ?? trim(
                                (string) (
                                    $customer
                                        ?->first_name
                                    ?? ''
                                )
                                . ' '
                                . (string) (
                                    $customer
                                        ?->last_name
                                    ?? ''
                                )
                            )
                            ?: 'Walk-in customer',
                        'customer_phone' =>
                            $customer?->phone,
                    ]
                    : null,
        ];
    }
}
