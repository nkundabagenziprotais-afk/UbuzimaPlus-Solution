<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\SystemNotification;
use App\Models\SystemNotificationRead;
use App\Models\Tenant;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function index(Request $request, ScopeResolver $scopeResolver): JsonResponse
    {
        $scope = $scopeResolver->resolveForUser($request->user());
        $tenantId = $scope->tenantId;

        $notifications = SystemNotification::query()
            ->with(['tenant', 'market', 'reads' => fn ($query) => $query->where('user_id', $request->user()->id)])
            ->where('status', 'published')
            ->when(
                ! $scope->isPlatform() && ! $scope->isSolution(),
                fn ($query) => $query->where(fn ($tenantQuery) => $tenantQuery
                    ->whereNull('tenant_id')
                    ->when($tenantId, fn ($tenantScopedQuery) => $tenantScopedQuery->orWhere('tenant_id', $tenantId)))
            )
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (SystemNotification $notification) => $this->notificationPayload($notification))
            ->values();

        return response()->json([
            'unread_count' => $notifications->where('read_at', null)->count(),
            'notifications' => $notifications,
        ]);
    }

    public function store(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:191'],
            'body' => ['required', 'string', 'max:5000'],
            'notification_type' => ['sometimes', 'string', 'max:80'],
            'audience_scope' => ['sometimes', 'string', 'max:80'],
            'tenant_slug' => ['nullable', 'string', 'max:191', Rule::exists('tenants', 'slug')],
            'market_code' => ['nullable', 'string', 'max:50', Rule::exists('markets', 'code')],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'metadata' => ['sometimes', 'array'],
        ]);

        $tenant = isset($validated['tenant_slug'])
            ? Tenant::query()->where('slug', $validated['tenant_slug'])->first()
            : null;
        $market = isset($validated['market_code'])
            ? Market::query()->where('code', $validated['market_code'])->first()
            : null;
        $status = $validated['status'] ?? 'published';

        $notification = SystemNotification::query()->create([
            'uuid' => (string) Str::uuid(),
            'tenant_id' => $tenant?->id,
            'market_id' => $market?->id,
            'title' => $validated['title'],
            'body' => $validated['body'],
            'notification_type' => $validated['notification_type'] ?? 'announcement',
            'channel' => 'in_app',
            'audience_scope' => $validated['audience_scope'] ?? 'all_staff',
            'status' => $status,
            'published_at' => $status === 'published' ? now() : null,
            'created_by' => $request->user()?->id,
            'metadata' => $validated['metadata'] ?? [
                'delivery' => 'in_app_now_sms_ready_later',
            ],
        ]);

        $auditLogService->record(
            action: 'notification.created',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'notification_id' => $notification->id,
                'tenant_id' => $tenant?->id,
                'market_id' => $market?->id,
                'status' => $notification->status,
            ],
            dataClassification: 'internal',
            auditableType: SystemNotification::class,
            auditableId: $notification->id
        );

        return response()->json([
            'message' => $status === 'published' ? 'Notification published.' : 'Notification saved as draft.',
            'notification' => $this->notificationPayload($notification->fresh(['tenant', 'market', 'reads'])),
        ], 201);
    }

    public function markRead(Request $request, SystemNotification $notification): JsonResponse
    {
        $read = SystemNotificationRead::query()->updateOrCreate(
            [
                'system_notification_id' => $notification->id,
                'user_id' => $request->user()->id,
            ],
            ['read_at' => now()]
        );

        return response()->json([
            'message' => 'Notification marked as read.',
            'read_at' => $read->read_at?->toISOString(),
        ]);
    }

    private function notificationPayload(SystemNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'uuid' => $notification->uuid,
            'title' => $notification->title,
            'body' => $notification->body,
            'notification_type' => $notification->notification_type,
            'channel' => $notification->channel,
            'audience_scope' => $notification->audience_scope,
            'status' => $notification->status,
            'published_at' => $notification->published_at?->toISOString(),
            'read_at' => $notification->reads->first()?->read_at?->toISOString(),
            'tenant' => $notification->tenant ? [
                'id' => $notification->tenant->id,
                'name' => $notification->tenant->name,
                'slug' => $notification->tenant->slug,
            ] : null,
            'market' => $notification->market ? [
                'id' => $notification->market->id,
                'code' => $notification->market->code,
                'name' => $notification->market->name,
            ] : null,
        ];
    }
}
