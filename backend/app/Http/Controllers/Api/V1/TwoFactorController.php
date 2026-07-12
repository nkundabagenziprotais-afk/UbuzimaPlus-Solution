<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TrustedDevice;
use App\Services\Auth\TwoFactorAuthenticationService;
use App\Services\Auth\UserAccessProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TwoFactorController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'two_factor' => [
                'required' => (bool) $user->two_factor_required,
                'enabled' => (bool) $user->two_factor_enabled,
                'confirmed_at' => optional($user->two_factor_confirmed_at)->toISOString(),
                'last_verified_at' => optional($user->two_factor_last_verified_at)->toISOString(),
                'trusted_device_days' => (int) config('auth.two_factor.trusted_device_days', 30),
                'trusted_devices' => $user->trustedDevices()
                    ->whereNull('revoked_at')
                    ->orderByDesc('last_used_at')
                    ->get()
                    ->map(fn (TrustedDevice $device) => [
                        'id' => $device->id,
                        'device_name' => $device->device_name,
                        'ip_address' => $device->ip_address,
                        'trusted_until' => optional($device->trusted_until)->toISOString(),
                        'last_used_at' => optional($device->last_used_at)->toISOString(),
                    ])
                    ->values()
                    ->all(),
            ],
        ]);
    }

    public function setup(Request $request, TwoFactorAuthenticationService $twoFactor): JsonResponse
    {
        $payload = $twoFactor->createSetupChallenge($request->user(), $request);

        return response()->json([
            'status' => 'two_factor_setup_ready',
            ...$payload,
        ]);
    }

    public function verify(
        Request $request,
        TwoFactorAuthenticationService $twoFactor,
        UserAccessProfileService $profileService
    ): JsonResponse {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['required', 'string', 'min:6', 'max:32'],
            'trust_device' => ['nullable', 'boolean'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $challenge = $twoFactor->findChallenge($data['challenge_token']);

        if (! $challenge || ! $challenge->user) {
            throw ValidationException::withMessages([
                'code' => ['The two-factor challenge has expired. Please sign in again.'],
            ]);
        }

        $user = $challenge->user;
        $previousLastLoginAt = $user->last_login_at;
        $recoveryCodes = null;

        if ($challenge->purpose === 'setup') {
            if (! $twoFactor->verifySetupChallenge($challenge, $data['code'])) {
                throw ValidationException::withMessages([
                    'code' => ['The authenticator code is not valid.'],
                ]);
            }

            $recoveryCodes = $twoFactor->enableForUser($user, $challenge->setup_secret);
        } elseif (! $twoFactor->verifyLoginChallenge($challenge, $data['code'])) {
            throw ValidationException::withMessages([
                'code' => ['The authenticator or recovery code is not valid.'],
            ]);
        } else {
            $twoFactor->markVerified($user);
        }

        $twoFactor->markChallengeUsed($challenge);

        $trustedDevice = null;

        if ((bool) ($data['trust_device'] ?? false)) {
            $trustedDevice = $twoFactor->createTrustedDevice($user, $request, $data['device_name'] ?? null);
        }

        $token = $user->createToken(
            $data['device_name'] ?? 'Ubuzima+ Dashboard',
            $profileService->permissionCodes($user) ?: ['authenticated']
        )->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'status' => 'two_factor_verified',
            'token_type' => 'Bearer',
            'access_token' => $token,
            'profile' => $profileService->build($user->fresh()),
            'recovery_codes' => $recoveryCodes,
            'trusted_device' => $trustedDevice,
            'login_experience' =>
                $this->loginExperiencePayload(
                    $user,
                    $previousLastLoginAt,
                    $trustedDevice !== null
                ),
        ]);
    }

    private function loginExperiencePayload(
        $user,
        mixed $previousLastLoginAt,
        bool $trustedDeviceUsed
    ): array {
        $firstLogin = $previousLastLoginAt === null;

        return [
            'first_login' => $firstLogin,
            'title' => $firstLogin
                ? 'Welcome'
                : 'Welcome Back',
            'user_name' => $user->name,
            'message' => $firstLogin
                ? 'Your secure Ubuzima+ workspace is ready.'
                : 'Your secure Ubuzima+ workspace has been restored.',
            'trusted_device_used' => $trustedDeviceUsed,
            'authenticated_at' => now()->toISOString(),
        ];
    }

    public function recoveryCodes(Request $request, TwoFactorAuthenticationService $twoFactor): JsonResponse
    {
        $user = $request->user();

        if (! $user->two_factor_enabled) {
            throw ValidationException::withMessages([
                'two_factor' => ['Two-factor authentication must be enabled first.'],
            ]);
        }

        $secret = $user->two_factor_secret;
        $recoveryCodes = $twoFactor->enableForUser($user, $secret);

        return response()->json([
            'status' => 'recovery_codes_regenerated',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function revokeTrustedDevice(Request $request, TrustedDevice $trustedDevice): JsonResponse
    {
        abort_unless($trustedDevice->user_id === $request->user()->id, 404);

        $trustedDevice->forceFill([
            'revoked_at' => now(),
        ])->save();

        return response()->json([
            'status' => 'trusted_device_revoked',
        ]);
    }
}
