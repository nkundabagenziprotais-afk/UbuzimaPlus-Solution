<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\UserLocalePreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LocalizationController extends Controller
{
    private array $supportedLanguages = [
        'en' => ['name' => 'English', 'native_name' => 'English'],
        'fr' => ['name' => 'French', 'native_name' => 'Francais'],
        'pt' => ['name' => 'Portuguese', 'native_name' => 'Portugues'],
    ];

    public function context(Request $request): JsonResponse
    {
        $market = $this->resolveMarket($request);
        $language = $this->resolveLanguage($request, $market);
        $countryCode = $this->countryCodeFromRequest($request);

        return response()->json([
            'supported_languages' => collect($this->supportedLanguages)
                ->map(fn (array $language, string $code) => ['code' => $code, ...$language])
                ->values(),
            'selected_language' => $language['code'],
            'language_source' => $language['source'],
            'market' => $market ? $this->marketPayload($market) : null,
            'ip_policy' => [
                'ip_address' => $request->ip(),
                'country_code' => $countryCode,
                'restricted_to_market' => $market?->code,
                'allowed' => (bool) $market,
                'message' => $market
                    ? 'Market detected. Service-provider discovery and tenant visibility should follow this market unless the user manually changes language.'
                    : 'No active market matched this IP or request context. Platform access remains limited until a market is selected.',
            ],
        ]);
    }

    public function setPreference(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => ['required', Rule::in(array_keys($this->supportedLanguages))],
            'market_code' => ['nullable', 'string', 'max:50', Rule::exists('markets', 'code')],
        ]);

        $market = isset($validated['market_code'])
            ? Market::query()->where('code', $validated['market_code'])->first()
            : null;

        $preference = UserLocalePreference::query()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'language' => $validated['language'],
                'market_id' => $market?->id,
                'source' => 'manual',
                'metadata' => [
                    'updated_from_ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ],
            ]
        );

        return response()->json([
            'message' => 'Localization preference saved.',
            'preference' => [
                'language' => $preference->language,
                'market' => $market ? $this->marketPayload($market) : null,
                'source' => $preference->source,
            ],
        ]);
    }

    private function resolveMarket(Request $request): ?Market
    {
        $requestedCode = $request->query('market_code') ?: $request->header('X-Market-Code');

        if ($requestedCode) {
            return Market::query()
                ->where('code', $requestedCode)
                ->where('status', 'active')
                ->first();
        }

        $countryCode = $this->countryCodeFromRequest($request);

        if ($countryCode) {
            $market = Market::query()
                ->where('country_code', strtoupper($countryCode))
                ->where('status', 'active')
                ->first();

            if ($market) {
                return $market;
            }
        }

        return Market::query()
            ->where('code', 'RW')
            ->where('status', 'active')
            ->first();
    }

    private function resolveLanguage(Request $request, ?Market $market): array
    {
        $manual = $request->query('language') ?: $request->header('X-Language');

        if ($manual && isset($this->supportedLanguages[$manual])) {
            return ['code' => $manual, 'source' => 'manual'];
        }

        $acceptLanguage = strtolower((string) $request->header('Accept-Language'));

        foreach (array_keys($this->supportedLanguages) as $code) {
            if (str_starts_with($acceptLanguage, $code) || str_contains($acceptLanguage, ',' . $code)) {
                return ['code' => $code, 'source' => 'browser'];
            }
        }

        return [
            'code' => $market?->default_language ?? 'en',
            'source' => $market ? 'market_default' : 'platform_default',
        ];
    }

    private function countryCodeFromRequest(Request $request): ?string
    {
        $countryCode = $request->header('CF-IPCountry')
            ?: $request->header('X-Country-Code')
            ?: $request->query('country_code');

        if ($countryCode) {
            return strtoupper((string) $countryCode);
        }

        $ip = $request->ip();

        return in_array($ip, ['127.0.0.1', '::1'], true) ? 'RW' : null;
    }

    private function marketPayload(Market $market): array
    {
        return [
            'id' => $market->id,
            'code' => $market->code,
            'name' => $market->name,
            'country_code' => $market->country_code,
            'default_language' => $market->default_language,
            'currency_code' => $market->currency_code,
            'timezone' => $market->timezone,
            'service_radius_km' => (float) $market->service_radius_km,
            'status' => $market->status,
        ];
    }
}
