<?php

namespace App\Http\Controllers\Api\V1\PharmaCo360;

use App\Http\Controllers\Controller;
use App\Services\Accounting\AccountingRequestScope;
use App\Services\Finance\FinancePeriodCloseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AccountingPeriodCloseController extends Controller
{
    public function __construct(
        private readonly AccountingRequestScope $scope,
        private readonly FinancePeriodCloseService $service
    ) {
    }

    public function readiness(
        Request $request,
        int $periodId
    ): JsonResponse {
        $scope =
            $this->scope->resolve(
                $request
            );

        return response()->json([
            'data' =>
                $this->service->readiness(
                    (int) $scope['tenant_id'],
                    $this->branch($scope),
                    $periodId
                ),
        ]);
    }

    public function index(
        Request $request
    ): JsonResponse {
        $scope =
            $this->scope->resolve(
                $request
            );

        $validated =
            $request->validate([
                'limit' =>
                    'nullable|integer|min:1|max:250',
            ]);

        return response()->json([
            'data' =>
                $this->service->actions(
                    (int) $scope['tenant_id'],
                    $this->branch($scope),
                    (int) (
                        $validated['limit']
                        ?? 100
                    )
                ),
        ]);
    }

    public function requestClose(
        Request $request,
        int $periodId
    ): JsonResponse {
        $validated =
            $request->validate([
                'reason' =>
                    'required|string|min:10|max:1000',
            ]);

        $scope =
            $this->scope->resolve(
                $request
            );

        return response()->json([
            'data' =>
                $this->service->requestClose(
                    (int) $scope['tenant_id'],
                    $this->branch($scope),
                    $periodId,
                    (int) $request
                        ->user()
                        ->getAuthIdentifier(),
                    $this->actor($request),
                    (string) $validated['reason']
                ),
        ],201);
    }

    public function requestReopen(
        Request $request,
        int $periodId
    ): JsonResponse {
        $validated =
            $request->validate([
                'reason' =>
                    'required|string|min:10|max:1000',
            ]);

        $scope =
            $this->scope->resolve(
                $request
            );

        return response()->json([
            'data' =>
                $this->service->requestReopen(
                    (int) $scope['tenant_id'],
                    $this->branch($scope),
                    $periodId,
                    (int) $request
                        ->user()
                        ->getAuthIdentifier(),
                    $this->actor($request),
                    (string) $validated['reason']
                ),
        ],201);
    }

    public function approve(
        Request $request,
        string $actionUuid
    ): JsonResponse {
        $validated =
            $request->validate([
                'comment' =>
                    'nullable|string|max:1000',
            ]);

        $scope =
            $this->scope->resolve(
                $request
            );

        return response()->json([
            'data' =>
                $this->service->approve(
                    (int) $scope['tenant_id'],
                    $this->branch($scope),
                    $actionUuid,
                    (int) $request
                        ->user()
                        ->getAuthIdentifier(),
                    $this->actor($request),
                    $validated['comment']
                        ?? null
                ),
        ]);
    }

    public function reject(
        Request $request,
        string $actionUuid
    ): JsonResponse {
        $validated =
            $request->validate([
                'comment' =>
                    'required|string|min:10|max:1000',
            ]);

        $scope =
            $this->scope->resolve(
                $request
            );

        return response()->json([
            'data' =>
                $this->service->reject(
                    (int) $scope['tenant_id'],
                    $actionUuid,
                    (int) $request
                        ->user()
                        ->getAuthIdentifier(),
                    $this->actor($request),
                    (string) $validated['comment']
                ),
        ]);
    }

    private function branch(
        array $scope
    ): ?int {
        return isset(
            $scope['branch_id']
        )
            && $scope['branch_id'] !== null
                ? (int) $scope['branch_id']
                : null;
    }

    private function actor(
        Request $request
    ): string {
        $user = $request->user();

        foreach ([
            'name',
            'full_name',
            'email',
        ] as $field) {
            $value = trim(
                (string) (
                    $user->{$field}
                    ?? ''
                )
            );

            if ($value !== '') {
                return mb_substr(
                    $value,
                    0,
                    191
                );
            }
        }

        return 'User '
            . $user->getAuthIdentifier();
    }
}
