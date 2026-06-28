<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Services\Access\ScopeContext;

class AuditLogService
{
    public function record(
        string $action,
        ?ScopeContext $scope = null,
        array $metadata = [],
        string $dataClassification = 'internal',
        ?string $auditableType = null,
        ?int $auditableId = null
    ): AuditLog {
        return AuditLog::query()->create([
            'user_id' => $scope?->userId,
            'solution_id' => $scope?->solutionId,
            'tenant_id' => $scope?->tenantId,
            'branch_id' => $scope?->branchId,
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'data_classification' => $dataClassification,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }
}
