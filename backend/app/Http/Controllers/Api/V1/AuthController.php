<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\TwoFactorAuthenticationService;
use App\Services\Auth\UserAccessProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
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
            'login_method' => ['nullable', 'in:email,phone'],
            'email' => ['nullable', 'email'],
            'password' => ['nullable', 'string'],
            'phone' => ['nullable', 'string', 'max:30'],
            'pin' => ['nullable', 'digits_between:4,6'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'trusted_device_token' => ['nullable', 'string', 'max:200'],
        ]);

        $loginMethod = $data['login_method']
            ?? (((string) ($data['email'] ?? '')) !== '' ? 'email' : 'phone');

        if ($loginMethod === 'email') {
            if (((string) ($data['email'] ?? '')) === '' || ((string) ($data['password'] ?? '')) === '') {
                throw ValidationException::withMessages([
                    'email' => ['Enter your staff email address and password.'],
                ]);
            }

            $user = User::query()
                ->where('email', $data['email'])
                ->first();

            $credentialIsValid = $user && Hash::check($data['password'], $user->password);
            $credentialField = 'email';
        } else {
            if (((string) ($data['phone'] ?? '')) === '' || ((string) ($data['pin'] ?? '')) === '') {
                throw ValidationException::withMessages([
                    'phone' => ['Enter your staff phone number and PIN.'],
                ]);
            }

            $user = User::query()
                ->whereIn('phone', $this->phoneCandidates($data['phone']))
                ->first();

            $credentialIsValid = $user?->login_pin && Hash::check($data['pin'], $user->login_pin);
            $credentialField = 'phone';
        }

        if (! $credentialIsValid) {
            throw ValidationException::withMessages([
                $credentialField => ['The provided credentials are not valid.'],
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                $credentialField => ['This user account is not active.'],
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


    public function passwordResetRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        try {
            Password::sendResetLink([
                'email' => $data['email'],
            ]);
        } catch (\Throwable $exception) {
            report($exception);
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'If this email is registered, password reset instructions will be processed. If email delivery is not configured yet, contact the platform administrator to reset access.',
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

    /**
     * Staff can type a local phone number with spaces, dashes, or a leading plus.
     * Store lookups should accept both +250... and 250... formats.
     *
     * @return array<int, string>
     */
    private function phoneCandidates(string $phone): array
    {
        $trimmed = trim($phone);
        $hasLeadingPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';
        $normalized = $hasLeadingPlus ? '+' . $digits : $digits;

        return array_values(array_unique(array_filter([
            $normalized,
            $digits,
            $digits !== '' ? '+' . $digits : null,
        ])));
    }
}
