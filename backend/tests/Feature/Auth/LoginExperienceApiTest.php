<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginExperienceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_login_returns_welcome_experience(): void
    {
        $user = User::factory()->create([
            'name' => 'Aline Uwase',
            'email' =>
                'aline.first@example.test',
            'password' => Hash::make(
                'SecurePassword123!'
            ),
            'status' => 'active',
            'two_factor_required' => false,
            'last_login_at' => null,
        ]);

        $this->postJson(
            '/api/v1/auth/login',
            [
                'login_method' => 'email',
                'email' => $user->email,
                'password' =>
                    'SecurePassword123!',
                'device_name' =>
                    'Automated Test Browser',
            ]
        )
            ->assertOk()
            ->assertJsonPath(
                'login_experience.first_login',
                true
            )
            ->assertJsonPath(
                'login_experience.title',
                'Welcome'
            )
            ->assertJsonPath(
                'login_experience.user_name',
                'Aline Uwase'
            );
    }

    public function test_returning_login_returns_welcome_back_experience(): void
    {
        $user = User::factory()->create([
            'name' => 'Aline Uwase',
            'email' =>
                'aline.returning@example.test',
            'password' => Hash::make(
                'SecurePassword123!'
            ),
            'status' => 'active',
            'two_factor_required' => false,
            'last_login_at' => now()->subDay(),
        ]);

        $this->postJson(
            '/api/v1/auth/login',
            [
                'login_method' => 'email',
                'email' => $user->email,
                'password' =>
                    'SecurePassword123!',
                'device_name' =>
                    'Automated Test Browser',
            ]
        )
            ->assertOk()
            ->assertJsonPath(
                'login_experience.first_login',
                false
            )
            ->assertJsonPath(
                'login_experience.title',
                'Welcome Back'
            );
    }
}
