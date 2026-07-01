<?php

namespace Tests\Feature;

use App\Models\PlatformContentSection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformContentManagementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_content_endpoint_returns_published_home_sections(): void
    {
        $this->seed();

        $this->getJson('/api/v1/platform-content/public')
            ->assertOk()
            ->assertJsonPath('pages.0.slug', 'home')
            ->assertJsonPath('pages.0.status', 'published')
            ->assertJsonPath('pages.0.sections.0.section_key', 'hero');
    }

    public function test_platform_admin_can_update_content_section(): void
    {
        $this->seed();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@ubuzimaplus.local',
            'password' => 'ChangeThisPassword123!',
            'device_name' => 'Platform Content Test',
        ]);

        $section = PlatformContentSection::query()
            ->where('section_key', 'hero')
            ->firstOrFail();

        $this->withToken($login->json('access_token'))
            ->patchJson("/api/v1/platform-management/sections/{$section->id}", [
                'title' => 'Updated public website title',
                'body' => 'Updated content through the Admin Center.',
                'status' => 'active',
                'style' => ['font_size' => 'large'],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'section_updated')
            ->assertJsonPath('section.title', 'Updated public website title')
            ->assertJsonPath('section.style.font_size', 'large');
    }
}
