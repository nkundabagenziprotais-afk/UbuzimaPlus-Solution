<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsuranceClaim;
use App\Models\InsuranceClaimSubmissionEvent;
use App\Models\InsuranceSalesRegister;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InsuranceClaimSubmissionController extends Controller
{
    public function updateSettings(Request $request, InsuranceClaim $insuranceClaim): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insuranceClaim->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'invoice_due_date' => ['nullable', 'date'],
            'reminder_lead_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'reminder_frequency' => ['nullable', 'string', Rule::in(['hourly', 'daily', 'weekly', 'monthly'])],
            'invoice_submission_status' => ['nullable', 'string', Rule::in(['pending', 'submitted', 'overdue', 'cancelled'])],
            'invoice_submission_reference' => ['nullable', 'string', 'max:191'],
        ]);

        $insuranceClaim->fill($validated);

        if (! empty($validated['invoice_due_date'])) {
            $leadDays = (int) ($validated['reminder_lead_days'] ?? $insuranceClaim->reminder_lead_days ?? 3);
            $insuranceClaim->next_reminder_at = CarbonImmutable::parse($validated['invoice_due_date'])
                ->subDays($leadDays)
                ->startOfDay();
        }

        $insuranceClaim->save();

        return response()->json([
            'message' => 'Claim invoice submission settings updated.',
            'claim' => $this->serializeSubmissionFields($insuranceClaim),
        ]);
    }

    public function recordEvent(Request $request, InsuranceClaim $insuranceClaim): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insuranceClaim->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'event_type' => ['nullable', 'string', Rule::in(['submission', 'reminder', 'note'])],
            'submission_channel' => ['required', 'string', Rule::in(['email', 'whatsapp', 'print', 'portal', 'manual'])],
            'submission_status' => ['nullable', 'string', Rule::in(['recorded', 'sent', 'delivered', 'failed', 'submitted'])],
            'recipient_name' => ['nullable', 'string', 'max:191'],
            'recipient_email' => ['nullable', 'email', 'max:191'],
            'recipient_phone' => ['nullable', 'string', 'max:80'],
            'submission_reference' => ['nullable', 'string', 'max:191'],
            'document_path' => ['nullable', 'string', 'max:255'],
            'annex_document_path' => ['nullable', 'string', 'max:255'],
            'message_body' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $event = InsuranceClaimSubmissionEvent::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_claim_id' => $insuranceClaim->id,
            'insurance_partner_id' => $insuranceClaim->insurance_partner_id,
            'event_type' => $validated['event_type'] ?? 'submission',
            'submission_channel' => $validated['submission_channel'],
            'submission_status' => $validated['submission_status'] ?? 'recorded',
            'recipient_name' => $validated['recipient_name'] ?? null,
            'recipient_email' => $validated['recipient_email'] ?? null,
            'recipient_phone' => $validated['recipient_phone'] ?? null,
            'submission_reference' => $validated['submission_reference'] ?? null,
            'document_path' => $validated['document_path'] ?? $insuranceClaim->invoice_document_path,
            'annex_document_path' => $validated['annex_document_path'] ?? $insuranceClaim->annex_document_path,
            'message_body' => $validated['message_body'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'metadata' => [
                'claim_number' => $insuranceClaim->claim_number,
                'share_link_ready' => $validated['submission_channel'] === 'whatsapp',
            ],
            'submitted_by' => $request->user()?->id,
            'submitted_at' => now(),
        ]);

        return response()->json([
            'message' => 'Claim submission event recorded.',
            'event' => $this->serializeEvent($event),
        ], 201);
    }

    public function markSubmitted(Request $request, InsuranceClaim $insuranceClaim): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insuranceClaim->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'invoice_submission_channel' => ['required', 'string', Rule::in(['email', 'whatsapp', 'print', 'portal', 'manual'])],
            'invoice_submission_reference' => ['nullable', 'string', 'max:191'],
            'recipient_name' => ['nullable', 'string', 'max:191'],
            'recipient_email' => ['nullable', 'email', 'max:191'],
            'recipient_phone' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $insuranceClaim->invoice_submission_status = 'submitted';
        $insuranceClaim->invoice_submission_channel = $validated['invoice_submission_channel'];
        $insuranceClaim->invoice_submission_reference = $validated['invoice_submission_reference'] ?? null;
        $insuranceClaim->invoice_submitted_at = now();
        $insuranceClaim->invoice_submitted_by = $request->user()?->id;
        $insuranceClaim->next_reminder_at = null;
        $insuranceClaim->save();

        $event = InsuranceClaimSubmissionEvent::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_claim_id' => $insuranceClaim->id,
            'insurance_partner_id' => $insuranceClaim->insurance_partner_id,
            'event_type' => 'submission',
            'submission_channel' => $validated['invoice_submission_channel'],
            'submission_status' => 'submitted',
            'recipient_name' => $validated['recipient_name'] ?? null,
            'recipient_email' => $validated['recipient_email'] ?? null,
            'recipient_phone' => $validated['recipient_phone'] ?? null,
            'submission_reference' => $validated['invoice_submission_reference'] ?? null,
            'document_path' => $insuranceClaim->invoice_document_path,
            'annex_document_path' => $insuranceClaim->annex_document_path,
            'notes' => $validated['notes'] ?? null,
            'metadata' => [
                'claim_number' => $insuranceClaim->claim_number,
                'reminders_stopped' => true,
            ],
            'submitted_by' => $request->user()?->id,
            'submitted_at' => now(),
        ]);

        return response()->json([
            'message' => 'Claim invoice marked as submitted.',
            'claim' => $this->serializeSubmissionFields($insuranceClaim),
            'event' => $this->serializeEvent($event),
        ]);
    }

    public function salesRegister(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $perPage = min(max((int) $request->query('per_page', 25), 1), 200);

        $register = InsuranceSalesRegister::query()
            ->with(['partner', 'institution', 'scheme'])
            ->where('tenant_id', $tenant->id)
            ->when($request->query('insurance_partner_id'), fn ($query, $partnerId) => $query->where('insurance_partner_id', $partnerId))
            ->when($request->query('insurance_institution_id'), fn ($query, $institutionId) => $query->where('insurance_institution_id', $institutionId))
            ->when($request->query('insurance_scheme_id'), fn ($query, $schemeId) => $query->where('insurance_scheme_id', $schemeId))
            ->when($request->query('claim_status'), fn ($query, $status) => $query->where('claim_status', $status))
            ->when($request->query('from'), fn ($query, $from) => $query->whereDate('sale_date', '>=', $from))
            ->when($request->query('to'), fn ($query, $to) => $query->whereDate('sale_date', '<=', $to))
            ->latest('sale_date')
            ->paginate($perPage);

        return response()->json([
            'register' => collect($register->items())->map(fn (InsuranceSalesRegister $entry) => [
                'id' => $entry->id,
                'uuid' => $entry->uuid,
                'sale_number' => $entry->sale_number,
                'sale_date' => $entry->sale_date?->toDateString(),
                'claim_period' => $entry->claim_period?->toDateString(),
                'customer_name' => $entry->customer_name_snapshot,
                'member_number' => $entry->member_number_snapshot,
                'product_name' => $entry->product_name_snapshot,
                'quantity' => (float) $entry->quantity,
                'gross_amount' => (float) $entry->gross_amount,
                'customer_contribution_amount' => (float) $entry->customer_contribution_amount,
                'insurer_claim_amount' => (float) $entry->insurer_claim_amount,
                'claim_number' => $entry->claim_number,
                'claim_status' => $entry->claim_status,
                'partner' => $entry->partner ? [
                    'id' => $entry->partner->id,
                    'code' => $entry->partner->code,
                    'name' => $entry->partner->name,
                ] : null,
                'institution' => $entry->institution ? [
                    'id' => $entry->institution->id,
                    'code' => $entry->institution->code,
                    'name' => $entry->institution->name,
                ] : null,
                'scheme' => $entry->scheme ? [
                    'id' => $entry->scheme->id,
                    'code' => $entry->scheme->code,
                    'name' => $entry->scheme->name,
                ] : null,
            ]),
            'meta' => [
                'current_page' => $register->currentPage(),
                'per_page' => $register->perPage(),
                'total' => $register->total(),
                'last_page' => $register->lastPage(),
            ],
        ]);
    }

    private function serializeSubmissionFields(InsuranceClaim $claim): array
    {
        return [
            'id' => $claim->id,
            'claim_number' => $claim->claim_number,
            'invoice_due_date' => $claim->invoice_due_date?->toDateString(),
            'invoice_submission_status' => $claim->invoice_submission_status,
            'invoice_submitted_at' => $claim->invoice_submitted_at?->toISOString(),
            'invoice_submitted_by' => $claim->invoice_submitted_by,
            'invoice_submission_reference' => $claim->invoice_submission_reference,
            'invoice_submission_channel' => $claim->invoice_submission_channel,
            'reminder_lead_days' => $claim->reminder_lead_days,
            'reminder_frequency' => $claim->reminder_frequency,
            'next_reminder_at' => $claim->next_reminder_at?->toISOString(),
            'last_reminder_at' => $claim->last_reminder_at?->toISOString(),
            'reminder_count' => $claim->reminder_count,
            'invoice_document_path' => $claim->invoice_document_path,
            'annex_document_path' => $claim->annex_document_path,
        ];
    }

    private function serializeEvent(InsuranceClaimSubmissionEvent $event): array
    {
        return [
            'id' => $event->id,
            'uuid' => $event->uuid,
            'insurance_claim_id' => $event->insurance_claim_id,
            'insurance_partner_id' => $event->insurance_partner_id,
            'event_type' => $event->event_type,
            'submission_channel' => $event->submission_channel,
            'submission_status' => $event->submission_status,
            'recipient_name' => $event->recipient_name,
            'recipient_email' => $event->recipient_email,
            'recipient_phone' => $event->recipient_phone,
            'submission_reference' => $event->submission_reference,
            'document_path' => $event->document_path,
            'annex_document_path' => $event->annex_document_path,
            'message_body' => $event->message_body,
            'notes' => $event->notes,
            'metadata' => $event->metadata ?? [],
            'submitted_by' => $event->submitted_by,
            'submitted_at' => $event->submitted_at?->toISOString(),
            'created_at' => $event->created_at?->toISOString(),
        ];
    }
}
