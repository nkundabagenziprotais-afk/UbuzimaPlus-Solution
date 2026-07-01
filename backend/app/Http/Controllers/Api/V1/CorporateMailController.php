<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CorporateMailAccount;
use App\Models\CorporateMailFolder;
use App\Models\CorporateMailMessage;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CorporateMailController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $account = $this->ensureAccount($request);
        $folderKey = (string) $request->query('folder', 'inbox');
        $folder = $account->folders()->where('folder_key', $folderKey)->first()
            ?? $account->folders()->orderBy('sort_order')->first();

        $messages = $folder
            ? $folder->messages()
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
                ->map(fn (CorporateMailMessage $message) => $this->messagePayload($message))
                ->values()
            : collect();

        return response()->json([
            'account' => [
                'id' => $account->id,
                'display_name' => $account->display_name,
                'email_address' => $account->email_address,
                'provider' => $account->provider,
                'status' => $account->status,
                'sync_status' => $account->sync_status,
                'last_synced_at' => $account->last_synced_at?->toISOString(),
                'configuration' => $account->configuration ?? [],
            ],
            'folders' => $account->folders()
                ->orderBy('sort_order')
                ->get()
                ->map(fn (CorporateMailFolder $folder) => [
                    'id' => $folder->id,
                    'folder_key' => $folder->folder_key,
                    'name' => $folder->name,
                    'unread_count' => $folder->unread_count,
                ])
                ->values(),
            'active_folder' => $folder?->folder_key,
            'messages' => $messages,
        ]);
    }

    public function send(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $account = $this->ensureAccount($request);

        $validated = $request->validate([
            'to' => ['required', 'array', 'min:1', 'max:20'],
            'to.*' => ['required', 'email', 'max:191'],
            'cc' => ['sometimes', 'array', 'max:20'],
            'cc.*' => ['required', 'email', 'max:191'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'importance' => ['sometimes', 'in:low,normal,high'],
        ]);

        $sentFolder = $account->folders()->where('folder_key', 'sent')->firstOrFail();
        $preview = Str::limit(trim(preg_replace('/\s+/', ' ', strip_tags($validated['body']))), 180);

        $message = CorporateMailMessage::query()->create([
            'uuid' => (string) Str::uuid(),
            'corporate_mail_account_id' => $account->id,
            'corporate_mail_folder_id' => $sentFolder->id,
            'message_uid' => 'local-' . Str::uuid(),
            'direction' => 'outbound',
            'subject' => $validated['subject'],
            'from_name' => $account->display_name,
            'from_email' => $account->email_address,
            'to_recipients' => $validated['to'],
            'cc_recipients' => $validated['cc'] ?? [],
            'body_preview' => $preview,
            'body' => $validated['body'],
            'importance' => $validated['importance'] ?? 'normal',
            'status' => 'queued_for_external_sync',
            'sent_at' => now(),
            'metadata' => [
                'source' => 'ubuzima_corporate_mail_module',
                'external_delivery' => 'pending_provider_integration',
            ],
        ]);

        $auditLogService->record(
            action: 'corporate_mail.message.sent',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'mail_account_id' => $account->id,
                'message_id' => $message->id,
                'to_count' => count($validated['to']),
            ],
            dataClassification: 'internal',
            auditableType: CorporateMailMessage::class,
            auditableId: $message->id
        );

        return response()->json([
            'message' => 'Message saved to Sent. External delivery is ready for provider integration.',
            'mail_message' => $this->messagePayload($message),
        ], 201);
    }

    private function ensureAccount(Request $request): CorporateMailAccount
    {
        $user = $request->user();
        $email = str_ends_with($user->email, '.local')
            ? 'info@ubuzimaplus.com'
            : $user->email;

        $account = CorporateMailAccount::query()->firstOrCreate(
            ['user_id' => $user->id, 'email_address' => $email],
            [
                'display_name' => $user->name,
                'provider' => 'local_mailbox',
                'status' => 'active',
                'sync_status' => 'local_ready_external_pending',
                'configuration' => [
                    'intended_provider' => 'microsoft_graph_or_imap_smtp',
                    'external_integration_status' => 'configure_company_mail_credentials',
                ],
            ]
        );

        $folders = [
            ['inbox', 'Inbox', 1],
            ['drafts', 'Drafts', 2],
            ['sent', 'Sent', 3],
            ['archive', 'Archive', 4],
        ];

        foreach ($folders as [$key, $name, $sortOrder]) {
            $account->folders()->firstOrCreate(
                ['folder_key' => $key],
                ['name' => $name, 'sort_order' => $sortOrder, 'unread_count' => 0]
            );
        }

        $inbox = $account->folders()->where('folder_key', 'inbox')->firstOrFail();

        if (! $account->messages()->exists()) {
            CorporateMailMessage::query()->create([
                'uuid' => (string) Str::uuid(),
                'corporate_mail_account_id' => $account->id,
                'corporate_mail_folder_id' => $inbox->id,
                'message_uid' => 'welcome-' . Str::uuid(),
                'direction' => 'inbound',
                'subject' => 'Welcome to Ubuzima+ corporate mail',
                'from_name' => 'Ubuzima+ Platform',
                'from_email' => 'info@ubuzimaplus.com',
                'to_recipients' => [$email],
                'body_preview' => 'Use this workspace for company email. External Microsoft/IMAP sync can be configured when credentials are approved.',
                'body' => 'Use this workspace for company email. External Microsoft Graph or IMAP/SMTP sync can be configured when the company email credentials and security policy are approved.',
                'importance' => 'normal',
                'status' => 'received',
                'received_at' => now(),
                'metadata' => ['seeded' => true],
            ]);
        }

        return $account->fresh(['folders']);
    }

    private function messagePayload(CorporateMailMessage $message): array
    {
        return [
            'id' => $message->id,
            'uuid' => $message->uuid,
            'folder_key' => $message->folder?->folder_key,
            'direction' => $message->direction,
            'subject' => $message->subject,
            'from_name' => $message->from_name,
            'from_email' => $message->from_email,
            'to_recipients' => $message->to_recipients ?? [],
            'cc_recipients' => $message->cc_recipients ?? [],
            'body_preview' => $message->body_preview,
            'body' => $message->body,
            'importance' => $message->importance,
            'status' => $message->status,
            'read_at' => $message->read_at?->toISOString(),
            'sent_at' => $message->sent_at?->toISOString(),
            'received_at' => $message->received_at?->toISOString(),
            'created_at' => $message->created_at?->toISOString(),
            'metadata' => $message->metadata ?? [],
        ];
    }
}
