<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PlatformContentPage;
use App\Models\PlatformContentSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlatformContentController extends Controller
{
    public function publicPages(): JsonResponse
    {
        return response()->json([
            'pages' => PlatformContentPage::query()
                ->with(['sections' => fn ($query) => $query->where('status', 'active')])
                ->where('status', 'published')
                ->orderBy('slug')
                ->get()
                ->map(fn (PlatformContentPage $page) => $this->serializePage($page))
                ->values()
                ->all(),
        ]);
    }

    public function adminPages(): JsonResponse
    {
        return response()->json([
            'pages' => PlatformContentPage::query()
                ->with('sections')
                ->orderBy('slug')
                ->get()
                ->map(fn (PlatformContentPage $page) => $this->serializePage($page))
                ->values()
                ->all(),
        ]);
    }

    public function storePage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:platform_content_pages,slug'],
            'title' => ['required', 'string', 'max:191'],
            'description' => ['nullable', 'string'],
            'template' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', Rule::in(['draft', 'published', 'archived'])],
        ]);

        $page = new PlatformContentPage();
        $page->fill([
            'slug' => $data['slug'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'template' => $data['template'] ?? 'standard',
            'status' => $data['status'] ?? 'draft',
            'seo' => [],
            'style' => [],
            'updated_by' => $request->user()->id,
        ]);
        $page->save();

        return response()->json([
            'status' => 'page_created',
            'page' => $this->serializePage($page->fresh('sections')),
        ], 201);
    }

    public function storeSection(Request $request, PlatformContentPage $page): JsonResponse
    {
        $data = $request->validate([
            'section_key' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:_[a-z0-9]+)*$/'],
            'eyebrow' => ['nullable', 'string', 'max:160'],
            'title' => ['nullable', 'string', 'max:191'],
            'body' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'hidden', 'draft'])],
        ]);

        $exists = $page->sections()
            ->where('section_key', $data['section_key'])
            ->exists();

        abort_if($exists, 422, 'A section with this key already exists on the page.');

        $section = new PlatformContentSection();
        $section->fill([
            'page_id' => $page->id,
            'section_key' => $data['section_key'],
            'eyebrow' => $data['eyebrow'] ?? null,
            'title' => $data['title'] ?? null,
            'body' => $data['body'] ?? null,
            'content' => [],
            'style' => [],
            'sort_order' => ((int) $page->sections()->max('sort_order')) + 1,
            'status' => $data['status'] ?? 'draft',
            'updated_by' => $request->user()->id,
        ]);
        $section->save();

        return response()->json([
            'status' => 'section_created',
            'section' => $this->serializeSection($section->fresh()),
        ], 201);
    }

    public function updatePage(Request $request, PlatformContentPage $page): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:191'],
            'description' => ['nullable', 'string'],
            'template' => ['sometimes', 'string', 'max:80'],
            'status' => ['sometimes', Rule::in(['draft', 'published', 'archived'])],
            'seo' => ['nullable', 'array'],
            'style' => ['nullable', 'array'],
        ]);

        if (($data['status'] ?? null) === 'published' && ! $page->published_at) {
            $data['published_at'] = now();
        }

        $page->fill([
            ...$data,
            'updated_by' => $request->user()->id,
        ])->save();

        return response()->json([
            'status' => 'page_updated',
            'page' => $this->serializePage($page->fresh('sections')),
        ]);
    }

    public function updateSection(Request $request, PlatformContentSection $section): JsonResponse
    {
        $data = $request->validate([
            'eyebrow' => ['nullable', 'string', 'max:160'],
            'title' => ['nullable', 'string', 'max:191'],
            'body' => ['nullable', 'string'],
            'content' => ['nullable', 'array'],
            'style' => ['nullable', 'array'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(['active', 'hidden', 'draft'])],
        ]);

        $section->fill([
            ...$data,
            'updated_by' => $request->user()->id,
        ])->save();

        return response()->json([
            'status' => 'section_updated',
            'section' => $this->serializeSection($section->fresh()),
        ]);
    }

    private function serializePage(PlatformContentPage $page): array
    {
        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'description' => $page->description,
            'template' => $page->template,
            'status' => $page->status,
            'seo' => $page->seo ?? [],
            'style' => $page->style ?? [],
            'published_at' => optional($page->published_at)->toISOString(),
            'sections' => $page->sections
                ->map(fn (PlatformContentSection $section) => $this->serializeSection($section))
                ->values()
                ->all(),
        ];
    }

    private function serializeSection(PlatformContentSection $section): array
    {
        return [
            'id' => $section->id,
            'section_key' => $section->section_key,
            'eyebrow' => $section->eyebrow,
            'title' => $section->title,
            'body' => $section->body,
            'content' => $section->content ?? [],
            'style' => $section->style ?? [],
            'sort_order' => $section->sort_order,
            'status' => $section->status,
            'updated_at' => optional($section->updated_at)->toISOString(),
        ];
    }
}
