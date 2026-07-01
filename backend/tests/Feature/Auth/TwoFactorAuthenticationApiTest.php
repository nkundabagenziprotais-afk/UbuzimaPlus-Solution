<?php

namespace Tests\Feature\Auth;

use App\Models\TwoFactorChallenge;
use App\Services\Auth\TwoFactorAuthenticationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorAuthenticationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_login_requires_two_factor_setup_when_enforced(): void
    {
        config(['auth.two_factor.staff_required' => true]);

        $this->seed();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Local Admin Dashboard',
        ]);

        $response->assertAccepted()
            ->assertJsonPath('status', 'two_factor_setup_required')
            ->assertJsonStructure([
                'challenge_token',
                'expires_at',
                'setup' => [
                    'manual_secret',
                    'otpauth_uri',
                    'qr_svg',
                ],
            ])
            ->assertJsonMissing(['access_token']);
    }

    public function test_staff_can_confirm_two_factor_setup_and_receive_trusted_device_token(): void
    {
        config(['auth.two_factor.staff_required' => true]);

        $this->seed();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Local Admin Dashboard',
        ]);

        $challenge = TwoFactorChallenge::query()->firstOrFail();
        $code = app(TwoFactorAuthenticationService::class)->currentCode($challenge->setup_secret);

        $response = $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $login->json('challenge_token'),
            'code' => $code,
            'trust_device' => true,
            'device_name' => 'Clinic counter laptop',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'two_factor_verified')
            ->assertJsonPath('profile.user.two_factor.enabled', true)
            ->assertJsonStructure([
                'access_token',
                'recovery_codes',
                'trusted_device' => [
                    'trusted_device_token',
                    'trusted_until',
                ],
            ]);

        $this->assertDatabaseCount('trusted_devices', 1);
    }

    public function test_trusted_device_token_allows_staff_login_without_new_challenge(): void
    {
        config(['auth.two_factor.staff_required' => true]);

        $this->seed();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Local Admin Dashboard',
        ]);

        $challenge = TwoFactorChallenge::query()->firstOrFail();
        $code = app(TwoFactorAuthenticationService::class)->currentCode($challenge->setup_secret);

        $verified = $this->postJson('/api/v1/auth/two-factor/verify', [
            'challenge_token' => $login->json('challenge_token'),
            'code' => $code,
            'trust_device' => true,
            'device_name' => 'Clinic counter laptop',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@vitapharmaafrica.com',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Clinic counter laptop',
            'trusted_device_token' => $verified->json('trusted_device.trusted_device_token'),
        ])->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonStructure(['access_token']);
    }
}
