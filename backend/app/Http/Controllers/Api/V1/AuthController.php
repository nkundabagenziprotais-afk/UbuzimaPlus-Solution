<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\TwoFactorAuthenticationService;
use App\Services\Auth\UserAccessProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(
        Request $request,
        UserAccessProfileService $profileService,
        TwoFactorAuthenticationService $twoFactor
    ): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'trusted_device_token' => ['nullable', 'string', 'max:200'],
        ]);

        $user = User::query()
            ->where('email', $data['email'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are not valid.'],
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['This user account is not active.'],
            ]);
        }

        if (
            $twoFactor->staffTwoFactorRequired($user)
            && ! $twoFactor->trustedDeviceIsValid($user, $data['trusted_device_token'] ?? null)
        ) {
            if (! $user->two_factor_enabled || ! $user->two_factor_secret) {
                return response()->json([
                    'status' => 'two_factor_setup_required',
                    'message' => 'Two-factor authentication is required for staff access.',
                    ...$twoFactor->createSetupChallenge($user, $request),
                ], 202);
            }

            return response()->json([
                'status' => 'two_factor_challenge_required',
                'message' => 'Enter your authenticator code or recovery code to continue.',
                'delivery_methods' => ['authenticator_code', 'recovery_code'],
                'trust_device_available' => true,
                ...$twoFactor->createLoginChallenge($user, $request),
            ], 202);
        }

        $abilities = $profileService->permissionCodes($user);

        if ($abilities === []) {
            $abilities = ['authenticated'];
        }

        $token = $user->createToken(
            $data['device_name'] ?? 'Ubuzima+ Dashboard',
            $abilities
        )->plainTextToken;

        $user->forceFill([
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'token_type' => 'Bearer',
            'access_token' => $token,
            'profile' => $profileService->build($user->fresh()),
        ]);
    }

    public function me(Request $request, UserAccessProfileService $profileService): JsonResponse
    {
        return response()->json([
            'profile' => $profileService->build($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $currentToken = $request->user()?->currentAccessToken();

        if ($currentToken && method_exists($currentToken, 'delete')) {
            $currentToken->delete();
        } elseif ($request->bearerToken()) {
            PersonalAccessToken::findToken($request->bearerToken())?->delete();
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'Signed out successfully.',
        ]);
    }
}
