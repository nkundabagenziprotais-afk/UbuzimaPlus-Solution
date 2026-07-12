<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class EnsureAnyPermission
{
    public function __construct(
        private readonly EnsurePermission $ensurePermission,
    ) {
    }

    public function handle(
        Request $request,
        Closure $next,
        string ...$permissions,
    ): mixed {
        $permissions = array_values(
            array_unique(
                array_filter(
                    array_map(
                        static fn (string $permission): string =>
                            trim($permission),
                        $permissions,
                    ),
                ),
            ),
        );

        if ($permissions === []) {
            abort(
                403,
                'At least one permission is required.',
            );
        }

        foreach ($permissions as $permission) {
            try {
                $allowed = $this->ensurePermission->handle(
                    $request,
                    static fn (): \Symfony\Component\HttpFoundation\Response =>
                        response()->noContent(),
                    $permission,
                );

                if ($allowed === true) {
                    return $next($request);
                }

                if (
                    is_object($allowed)
                    && method_exists(
                        $allowed,
                        'getStatusCode',
                    )
                ) {
                    if ($allowed->getStatusCode() === 403) {
                        continue;
                    }

                    return $next($request);
                }
            } catch (AuthorizationException) {
                continue;
            } catch (HttpResponseException $exception) {
                if (
                    $exception->getResponse()
                        ->getStatusCode() === 403
                ) {
                    continue;
                }

                throw $exception;
            } catch (HttpExceptionInterface $exception) {
                if ($exception->getStatusCode() === 403) {
                    continue;
                }

                throw $exception;
            }
        }

        abort(
            403,
            'You do not have permission to perform this action.',
        );
    }
}
