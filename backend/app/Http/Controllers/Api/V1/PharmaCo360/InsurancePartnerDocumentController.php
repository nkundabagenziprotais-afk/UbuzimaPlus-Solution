<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Models\InsurancePartner;
use App\Models\InsurancePartnerDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InsurancePartnerDocumentController extends Controller
{
    public function index(Request $request, InsurancePartner $insurancePartner): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insurancePartner->tenant_id === (int) $tenant->id, 404);

        $documents = InsurancePartnerDocument::query()
            ->where('tenant_id', $tenant->id)
            ->where('insurance_partner_id', $insurancePartner->id)
            ->latest()
            ->get()
            ->map(fn (InsurancePartnerDocument $document) => $this->serializeDocument($document));

        return response()->json([
            'documents' => $documents,
        ]);
    }

    public function store(Request $request, InsurancePartner $insurancePartner): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insurancePartner->tenant_id === (int) $tenant->id, 404);

        $validated = $request->validate([
            'document_type' => [
                'required',
                'string',
                Rule::in([
                    'contract',
                    'acceptance_letter',
                    'amendment',
                    'price_list',
                    'claim_guide',
                    'accreditation',
                    'tax_registration',
                    'logo',
                    'termination_notice',
                    'other',
                ]),
            ],
            'title' => ['required', 'string', 'max:191'],
            'version' => ['nullable', 'string', 'max:40'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'status' => ['nullable', 'string', Rule::in(['active', 'expired', 'replaced', 'revoked', 'draft'])],
            'is_primary' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'file' => [
                'required',
                'file',
                'max:15360',
                'mimes:pdf,jpg,jpeg,png,webp,csv,xlsx,doc,docx',
            ],
        ]);

        $file = $request->file('file');
        $path = $file->store(
            sprintf(
                'insurance/partner-documents/%s/%s',
                $tenant->id,
                $insurancePartner->id
            ),
            'public'
        );

        if (($validated['is_primary'] ?? false) === true) {
            InsurancePartnerDocument::query()
                ->where('tenant_id', $tenant->id)
                ->where('insurance_partner_id', $insurancePartner->id)
                ->where('document_type', $validated['document_type'])
                ->update(['is_primary' => false]);
        }

        $document = InsurancePartnerDocument::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'insurance_partner_id' => $insurancePartner->id,
            'document_type' => $validated['document_type'],
            'title' => $validated['title'],
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'version' => $validated['version'] ?? null,
            'effective_from' => $validated['effective_from'] ?? null,
            'effective_to' => $validated['effective_to'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'is_primary' => (bool) ($validated['is_primary'] ?? false),
            'notes' => $validated['notes'] ?? null,
            'metadata' => [
                'source' => 'admin_upload',
                'storage_disk' => 'public',
            ],
            'uploaded_by' => $request->user()?->id,
            'uploaded_at' => now(),
        ]);

        if ($document->document_type === 'logo' && $document->is_primary) {
            $insurancePartner->metadata = [
                ...($insurancePartner->metadata ?? []),
                'logo_document_id' => $document->id,
                'logo_path' => $document->file_path,
            ];
            $insurancePartner->save();
        }

        return response()->json([
            'message' => 'Insurance partner document uploaded successfully.',
            'document' => $this->serializeDocument($document),
        ], 201);
    }

    public function update(
        Request $request,
        InsurancePartner $insurancePartner,
        InsurancePartnerDocument $document
    ): JsonResponse {
        $tenant = $request->attributes->get('tenant');

        abort_unless((int) $insurancePartner->tenant_id === (int) $tenant->id, 404);
        abort_unless((int) $document->tenant_id === (int) $tenant->id, 404);
        abort_unless((int) $document->insurance_partner_id === (int) $insurancePartner->id, 404);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:191'],
            'version' => ['nullable', 'string', 'max:40'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'expired', 'replaced', 'revoked', 'draft'])],
            'is_primary' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        if (($validated['is_primary'] ?? false) === true) {
            InsurancePartnerDocument::query()
                ->where('tenant_id', $tenant->id)
                ->where('insurance_partner_id', $insurancePartner->id)
                ->where('document_type', $document->document_type)
                ->where('id', '!=', $document->id)
                ->update(['is_primary' => false]);
        }

        $document->fill($validated);
        $document->save();

        if ($document->document_type === 'logo' && $document->is_primary) {
            $insurancePartner->metadata = [
                ...($insurancePartner->metadata ?? []),
                'logo_document_id' => $document->id,
                'logo_path' => $document->file_path,
            ];
            $insurancePartner->save();
        }

        return response()->json([
            'message' => 'Insurance partner document updated successfully.',
            'document' => $this->serializeDocument($document),
        ]);
    }

    private function serializeDocument(InsurancePartnerDocument $document): array
    {
        return [
            'id' => $document->id,
            'uuid' => $document->uuid,
            'insurance_partner_id' => $document->insurance_partner_id,
            'document_type' => $document->document_type,
            'title' => $document->title,
            'file_path' => $document->file_path,
            'public_url' => Storage::disk('public')->url($document->file_path),
            'original_filename' => $document->original_filename,
            'mime_type' => $document->mime_type,
            'file_size' => $document->file_size,
            'version' => $document->version,
            'effective_from' => $document->effective_from?->toDateString(),
            'effective_to' => $document->effective_to?->toDateString(),
            'status' => $document->status,
            'is_primary' => (bool) $document->is_primary,
            'notes' => $document->notes,
            'metadata' => $document->metadata ?? [],
            'uploaded_by' => $document->uploaded_by,
            'uploaded_at' => $document->uploaded_at?->toISOString(),
            'created_at' => $document->created_at?->toISOString(),
            'updated_at' => $document->updated_at?->toISOString(),
        ];
    }
}
