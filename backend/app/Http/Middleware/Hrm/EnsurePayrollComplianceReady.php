<?php

declare(strict_types=1);

namespace App\Http\Middleware\Hrm;

use App\Http\Controllers\Api\V1\Hrm\PayrollClosureController;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePayrollComplianceReady
{
    public function __construct(
        private readonly PayrollClosureController $closure
    ) {
    }

    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $runId =
            (int) $request->route(
                'runId'
            );

        if ($runId < 1) {
            return response()->json([
                'message' =>
                    'Payroll run could not be resolved. Approval stopped safely.',

                'code' =>
                    'PAYROLL_RUN_NOT_RESOLVED',
            ], 422);
        }

        $method =
            new \ReflectionMethod(
                PayrollClosureController::class,
                'compliance'
            );

        $parameters =
            $method->getParameters();

        $type =
            $parameters[2]->getType()
            ?? null;

        if (
            ! $type instanceof \ReflectionNamedType
            ||
            $type->isBuiltin()
        ) {
            return response()->json([
                'message' =>
                    'Payroll compliance scope could not be resolved. Approval stopped safely.',

                'code' =>
                    'PAYROLL_COMPLIANCE_SCOPE_UNRESOLVED',
            ], 422);
        }

        $scopeResolver =
            app(
                $type->getName()
            );

        $response =
            $this->closure->compliance(
                $request,
                $runId,
                $scopeResolver
            );

        if (
            method_exists(
                $response,
                'getStatusCode'
            )
            &&
            $response->getStatusCode()
                >=
                400
        ) {
            return $response;
        }

        $payload =
            method_exists(
                $response,
                'getData'
            )
                ? $response->getData(true)
                : [];

        $blockers =
            is_array($payload)
                ? $this->blockerCount(
                    $payload
                )
                : null;

        if ($blockers === null) {
            return response()->json([
                'message' =>
                    'Payroll compliance blocker state could not be resolved. Approval stopped safely.',

                'code' =>
                    'PAYROLL_COMPLIANCE_STATE_UNRESOLVED',
            ], 422);
        }

        if ($blockers > 0) {
            return response()->json([
                'message' =>
                    'Payroll approval is blocked until all statutory and payment-readiness blockers are resolved.',

                'code' =>
                    'PAYROLL_COMPLIANCE_BLOCKED',

                'blocker_count' =>
                    $blockers,

                'compliance' =>
                    $payload,
            ], 422);
        }

        return $next(
            $request
        );
    }

    private function blockerCount(
        array $data
    ): ?int {
        foreach (
            [
                'blocker_count',
                'blockers_count',
                'blocking_count',
                'blocking_issues_count',
            ]
            as $key
        ) {
            if (
                array_key_exists(
                    $key,
                    $data
                )
                &&
                is_numeric(
                    $data[$key]
                )
            ) {
                return max(
                    0,
                    (int) $data[$key]
                );
            }
        }

        foreach (
            [
                'blockers',
                'blocking_issues',
                'blockingIssues',
            ]
            as $key
        ) {
            if (
                array_key_exists(
                    $key,
                    $data
                )
                &&
                is_array(
                    $data[$key]
                )
            ) {
                return count(
                    $data[$key]
                );
            }
        }

        foreach ($data as $value) {
            if (! is_array($value)) {
                continue;
            }

            $found =
                $this->blockerCount(
                    $value
                );

            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }
}
