<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PharmacistChatConversation;
use App\Models\PharmacistChatMessage;
use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PharmacistChatController extends Controller
{
    public function createMobileConversation(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_slug' => ['nullable', 'string', 'max:120'],
            'customer_name' => ['required', 'string', 'max:191'],
            'customer_phone' => ['nullable', 'string', 'max:80'],
            'customer_email' => ['nullable', 'email', 'max:191'],
            'message' => ['required', 'string', 'max:5000'],
            'priority' => ['sometimes', Rule::in(['low', 'normal', 'urgent'])],
        ]);

        $tenant = Tenant::query()
            ->where('slug', $validated['tenant_slug'] ?? 'vitapharma')
            ->first();

        $conversation = PharmacistChatConversation::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant?->id,
            'customer_name' => $validated['customer_name'],
            'customer_phone' => $validated['customer_phone'] ?? null,
            'customer_email' => $validated['customer_email'] ?? null,
            'source_channel' => 'mobile_app',
            'status' => 'open',
            'priority' => $validated['priority'] ?? 'normal',
            'last_message_at' => now(),
            'metadata' => [
                'mobile_provision' => 'public_customer_chat_entry',
                'disclaimer' => 'Emergency cases should use local emergency or clinical channels.',
            ],
        ]);

        $message = $this->addMessage($conversation, [
            'sender_type' => 'customer',
            'sender_display_name' => $validated['customer_name'],
            'body' => $validated['message'],
        ]);

        return response()->json([
            'message' => 'Chat request received. A pharmacist can respond from the staff workspace.',
            'conversation' => $this->conversationPayload($conversation->fresh(['tenant', 'branch', 'assignedPharmacist'])),
            'chat_message' => $this->messagePayload($message),
        ], 201);
    }

    public function mobileConversation(PharmacistChatConversation $conversation): JsonResponse
    {
        $conversation->load(['tenant', 'branch', 'assignedPharmacist', 'messages.sender']);

        return response()->json([
            'conversation' => $this->conversationPayload($conversation),
            'messages' => $conversation->messages
                ->map(fn (PharmacistChatMessage $message) => $this->messagePayload($message))
                ->values(),
        ]);
    }

    public function createMobileMessage(
        Request $request,
        PharmacistChatConversation $conversation
    ): JsonResponse {
        $validated = $request->validate([
            'sender_display_name' => ['nullable', 'string', 'max:191'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $this->addMessage($conversation, [
            'sender_type' => 'customer',
            'sender_display_name' => $validated['sender_display_name'] ?? $conversation->customer_name,
            'body' => $validated['body'],
        ]);

        return response()->json([
            'message' => 'Message added.',
            'chat_message' => $this->messagePayload($message),
        ], 201);
    }

    public function staffConversations(Request $request): JsonResponse
    {
        $conversations = PharmacistChatConversation::query()
            ->with(['tenant', 'branch', 'assignedPharmacist', 'messages' => fn ($query) => $query->latest()->limit(1)])
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get()
            ->map(fn (PharmacistChatConversation $conversation) => $this->conversationPayload($conversation))
            ->values();

        return response()->json([
            'conversations' => $conversations,
        ]);
    }

    public function staffConversation(PharmacistChatConversation $conversation): JsonResponse
    {
        $conversation->load(['tenant', 'branch', 'assignedPharmacist', 'messages.sender']);

        return response()->json([
            'conversation' => $this->conversationPayload($conversation),
            'messages' => $conversation->messages
                ->map(fn (PharmacistChatMessage $message) => $this->messagePayload($message))
                ->values(),
        ]);
    }

    public function staffReply(
        Request $request,
        PharmacistChatConversation $conversation,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $this->addMessage($conversation, [
            'sender_type' => 'pharmacist',
            'sender_user_id' => $request->user()->id,
            'sender_display_name' => $request->user()->name,
            'body' => $validated['body'],
        ]);

        if (! $conversation->assigned_pharmacist_id) {
            $conversation->assigned_pharmacist_id = $request->user()->id;
            $conversation->save();
        }

        $auditLogService->record(
            action: 'pharmacist_chat.replied',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: ['conversation_uuid' => $conversation->uuid],
            dataClassification: 'confidential',
            auditableType: PharmacistChatConversation::class,
            auditableId: $conversation->id
        );

        return response()->json([
            'message' => 'Reply sent to conversation.',
            'chat_message' => $this->messagePayload($message),
            'conversation' => $this->conversationPayload($conversation->fresh(['tenant', 'branch', 'assignedPharmacist'])),
        ], 201);
    }

    public function updateStaffConversation(
        Request $request,
        PharmacistChatConversation $conversation
    ): JsonResponse {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(['open', 'waiting_customer', 'resolved', 'closed'])],
            'priority' => ['sometimes', Rule::in(['low', 'normal', 'urgent'])],
            'assigned_pharmacist_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
        ]);

        $conversation->fill($validated);
        $conversation->save();

        return response()->json([
            'message' => 'Chat conversation updated.',
            'conversation' => $this->conversationPayload($conversation->fresh(['tenant', 'branch', 'assignedPharmacist'])),
        ]);
    }

    private function addMessage(PharmacistChatConversation $conversation, array $payload): PharmacistChatMessage
    {
        $message = PharmacistChatMessage::query()->create([
            'uuid' => (string) Str::uuid(),
            'pharmacist_chat_conversation_id' => $conversation->id,
            'sender_type' => $payload['sender_type'],
            'sender_user_id' => $payload['sender_user_id'] ?? null,
            'sender_display_name' => $payload['sender_display_name'] ?? null,
            'body' => $payload['body'],
            'attachments' => [],
            'metadata' => [],
        ]);

        $conversation->last_message_at = now();
        $conversation->save();

        return $message;
    }

    private function conversationPayload(PharmacistChatConversation $conversation): array
    {
        $latest = $conversation->relationLoaded('messages') ? $conversation->messages->first() : null;

        return [
            'id' => $conversation->id,
            'uuid' => $conversation->uuid,
            'customer_name' => $conversation->customer_name,
            'customer_phone' => $conversation->customer_phone,
            'customer_email' => $conversation->customer_email,
            'source_channel' => $conversation->source_channel,
            'status' => $conversation->status,
            'priority' => $conversation->priority,
            'last_message_at' => $conversation->last_message_at?->toISOString(),
            'tenant' => $conversation->tenant ? [
                'id' => $conversation->tenant->id,
                'name' => $conversation->tenant->name,
                'slug' => $conversation->tenant->slug,
            ] : null,
            'branch' => $conversation->branch ? [
                'id' => $conversation->branch->id,
                'name' => $conversation->branch->name,
                'code' => $conversation->branch->code,
            ] : null,
            'assigned_pharmacist' => $conversation->assignedPharmacist ? [
                'id' => $conversation->assignedPharmacist->id,
                'name' => $conversation->assignedPharmacist->name,
                'email' => $conversation->assignedPharmacist->email,
            ] : null,
            'latest_message' => $latest ? $this->messagePayload($latest) : null,
        ];
    }

    private function messagePayload(PharmacistChatMessage $message): array
    {
        return [
            'id' => $message->id,
            'uuid' => $message->uuid,
            'sender_type' => $message->sender_type,
            'sender_user_id' => $message->sender_user_id,
            'sender_display_name' => $message->sender_display_name,
            'body' => $message->body,
            'read_at' => $message->read_at?->toISOString(),
            'created_at' => $message->created_at?->toISOString(),
        ];
    }
}
