<?php

namespace App\Services\Tax;

use App\Models\RraExemptionAlias;
use App\Models\RraExemptionItem;
use App\Models\RraExemptionList;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class RraExemptionRegistryService
{
    private const MAX_SCAN = 250;

    public function summary(?string $asOf = null): array
    {
        $date = $this->asOf($asOf);

        $listIds = $this->approvedListQuery($date)
            ->pluck('id');

        $itemCount = $listIds->isEmpty()
            ? 0
            : RraExemptionItem::query()
                ->whereIn(
                    'rra_exemption_list_id',
                    $listIds->all()
                )
                ->where('status', 'active')
                ->count();

        $aliasCount = $listIds->isEmpty()
            ? 0
            : RraExemptionAlias::query()
                ->where('status', 'active')
                ->whereHas(
                    'exemptionItem',
                    function (Builder $query) use ($listIds): void {
                        $query
                            ->whereIn(
                                'rra_exemption_list_id',
                                $listIds->all()
                            )
                            ->where('status', 'active');
                    }
                )
                ->count();

        return [
            'as_of' => $date->toDateString(),
            'approved_active_lists' => $listIds->count(),
            'active_items' => $itemCount,
            'active_aliases' => $aliasCount,
            'policy' => $this->policy(),
        ];
    }

    public function editions(int $limit = 25): Collection
    {
        $safeLimit = max(1, min($limit, 100));

        return RraExemptionList::query()
            ->withCount('items')
            ->orderByDesc('publication_date')
            ->orderByDesc('id')
            ->limit($safeLimit)
            ->get()
            ->map(
                static function (RraExemptionList $list): array {
                    return [
                        'id' => (int) $list->id,
                        'uuid' => $list->uuid,
                        'code' => $list->code,
                        'title' => $list->title,
                        'list_type' => $list->list_type,
                        'issuing_authority' =>
                            $list->issuing_authority,
                        'version_label' => $list->version_label,
                        'publication_date' =>
                            optional($list->publication_date)
                                ->toDateString(),
                        'effective_from' =>
                            optional($list->effective_from)
                                ->toDateString(),
                        'effective_to' =>
                            optional($list->effective_to)
                                ->toDateString(),
                        'source_url' => $list->source_url,
                        'source_sha256' => $list->source_sha256,
                        'source_format' => $list->source_format,
                        'import_status' => $list->import_status,
                        'status' => $list->status,
                        'record_count' =>
                            (int) ($list->record_count ?? 0),
                        'items_count' =>
                            (int) ($list->items_count ?? 0),
                        'approved_at' =>
                            optional($list->approved_at)
                                ->toIso8601String(),
                    ];
                }
            );
    }

    public function search(array $filters): array
    {
        $date = $this->asOf(
            $filters['as_of'] ?? null
        );

        $name = $this->normalise(
            $filters['query'] ?? null
        );

        $registrationNumber = strtoupper(
            trim(
                (string) (
                    $filters['registration_number']
                    ?? ''
                )
            )
        );

        $hsCode = strtoupper(
            preg_replace(
                '/\s+/',
                '',
                trim(
                    (string) (
                        $filters['hs_code']
                        ?? ''
                    )
                )
            )
        );

        $dosageForm = $this->normalise(
            $filters['dosage_form'] ?? null
        );

        $strength = $this->normalise(
            $filters['strength'] ?? null
        );

        if (
            $name === ''
            && $registrationNumber === ''
            && $hsCode === ''
        ) {
            throw new InvalidArgumentException(
                'Provide a name, registration number, '
                .'or HS code to search the registry.'
            );
        }

        $limit = max(
            1,
            min(
                (int) ($filters['limit'] ?? 20),
                50
            )
        );

        $scanLimit = min(
            max($limit * 5, 50),
            self::MAX_SCAN
        );

        $query = RraExemptionItem::query()
            ->with([
                'exemptionList',
                'aliases' => static function (
                    $query
                ): void {
                    $query->where('status', 'active');
                },
            ])
            ->where('status', 'active')
            ->whereHas(
                'exemptionList',
                function (Builder $query) use ($date): void {
                    $this->applyApprovedListScope(
                        $query,
                        $date
                    );
                }
            )
            ->where(
                function (Builder $query) use (
                    $name,
                    $registrationNumber,
                    $hsCode
                ): void {
                    if ($name !== '') {
                        $query
                            ->orWhere(
                                'normalised_name',
                                $name
                            )
                            ->orWhere(
                                'normalised_generic_name',
                                $name
                            )
                            ->orWhere(
                                'normalised_name',
                                'like',
                                $name.'%'
                            )
                            ->orWhere(
                                'normalised_generic_name',
                                'like',
                                $name.'%'
                            )
                            ->orWhereHas(
                                'aliases',
                                static function (
                                    Builder $query
                                ) use ($name): void {
                                    $query
                                        ->where(
                                            'status',
                                            'active'
                                        )
                                        ->where(
                                            function (
                                                Builder $query
                                            ) use ($name): void {
                                                $query
                                                    ->where(
                                                        'normalised_alias',
                                                        $name
                                                    )
                                                    ->orWhere(
                                                        'normalised_alias',
                                                        'like',
                                                        $name.'%'
                                                    );
                                            }
                                        );
                                }
                            );
                    }

                    if ($registrationNumber !== '') {
                        $query->orWhere(
                            'registration_number',
                            $registrationNumber
                        );
                    }

                    if ($hsCode !== '') {
                        $query->orWhere(
                            'hs_code',
                            $hsCode
                        );
                    }
                }
            );

        if ($dosageForm !== '') {
            $query->whereRaw(
                'LOWER(dosage_form) = ?',
                [$dosageForm]
            );
        }

        if ($strength !== '') {
            $query->whereRaw(
                'LOWER(strength) = ?',
                [$strength]
            );
        }

        $candidates = $query
            ->limit($scanLimit)
            ->get()
            ->map(
                function (
                    RraExemptionItem $item
                ) use (
                    $name,
                    $registrationNumber,
                    $hsCode,
                    $dosageForm,
                    $strength
                ): array {
                    return $this->candidatePayload(
                        $item,
                        $name,
                        $registrationNumber,
                        $hsCode,
                        $dosageForm,
                        $strength
                    );
                }
            )
            ->filter(
                static fn (array $candidate): bool =>
                    $candidate['match_score'] > 0
            )
            ->sortByDesc('match_score')
            ->take($limit)
            ->values();

        return [
            'query' => [
                'name' => $name ?: null,
                'registration_number' =>
                    $registrationNumber ?: null,
                'hs_code' => $hsCode ?: null,
                'dosage_form' =>
                    $dosageForm ?: null,
                'strength' => $strength ?: null,
                'as_of' => $date->toDateString(),
                'limit' => $limit,
            ],
            'candidate_count' => $candidates->count(),
            'candidates' => $candidates,
            'policy' => $this->policy(),
        ];
    }

    private function candidatePayload(
        RraExemptionItem $item,
        string $name,
        string $registrationNumber,
        string $hsCode,
        string $dosageForm,
        string $strength
    ): array {
        $score = 0;
        $reasons = [];

        $normalisedName = (string) $item->normalised_name;
        $normalisedGeneric = (string) (
            $item->normalised_generic_name ?? ''
        );

        $normalisedAliases = $item->aliases
            ->pluck('normalised_alias')
            ->filter()
            ->map(
                static fn ($value): string =>
                    (string) $value
            )
            ->values();

        if (
            $registrationNumber !== ''
            && strtoupper(
                (string) $item->registration_number
            ) === $registrationNumber
        ) {
            $score += 100;
            $reasons[] =
                'registration_number_exact';
        }

        if (
            $hsCode !== ''
            && strtoupper(
                preg_replace(
                    '/\s+/',
                    '',
                    (string) $item->hs_code
                )
            ) === $hsCode
        ) {
            $score += 60;
            $reasons[] = 'hs_code_exact';
        }

        if ($name !== '') {
            if (
                $normalisedName === $name
                || $normalisedGeneric === $name
            ) {
                $score += 90;
                $reasons[] = 'official_or_generic_name_exact';
            } elseif ($normalisedAliases->contains($name)) {
                $score += 85;
                $reasons[] = 'alias_exact';
            } elseif (
                str_starts_with(
                    $normalisedName,
                    $name
                )
                || str_starts_with(
                    $normalisedGeneric,
                    $name
                )
            ) {
                $score += 60;
                $reasons[] =
                    'official_or_generic_name_prefix';
            } elseif (
                $normalisedAliases->contains(
                    static fn (string $alias): bool =>
                        str_starts_with($alias, $name)
                )
            ) {
                $score += 55;
                $reasons[] = 'alias_prefix';
            }
        }

        if (
            $dosageForm !== ''
            && $this->normalise(
                $item->dosage_form
            ) === $dosageForm
        ) {
            $score += 10;
            $reasons[] = 'dosage_form_exact';
        }

        if (
            $strength !== ''
            && $this->normalise(
                $item->strength
            ) === $strength
        ) {
            $score += 10;
            $reasons[] = 'strength_exact';
        }

        $list = $item->exemptionList;

        return [
            'item' => [
                'id' => (int) $item->id,
                'uuid' => $item->uuid,
                'sequence_number' =>
                    (int) $item->sequence_number,
                'official_name' => $item->official_name,
                'generic_name' => $item->generic_name,
                'trade_name' => $item->trade_name,
                'dosage_form' => $item->dosage_form,
                'strength' => $item->strength,
                'pack_size' => $item->pack_size,
                'registration_number' =>
                    $item->registration_number,
                'hs_code' => $item->hs_code,
                'manufacturer' => $item->manufacturer,
                'eligibility_scope' =>
                    $item->eligibility_scope,
                'aliases' => $item->aliases
                    ->pluck('alias')
                    ->values(),
            ],
            'registry_edition' => $list
                ? [
                    'id' => (int) $list->id,
                    'uuid' => $list->uuid,
                    'code' => $list->code,
                    'title' => $list->title,
                    'version_label' =>
                        $list->version_label,
                    'issuing_authority' =>
                        $list->issuing_authority,
                    'effective_from' =>
                        optional($list->effective_from)
                            ->toDateString(),
                    'effective_to' =>
                        optional($list->effective_to)
                            ->toDateString(),
                    'source_sha256' =>
                        $list->source_sha256,
                ]
                : null,
            'match_score' => min($score, 100),
            'match_reasons' => array_values(
                array_unique($reasons)
            ),
            'registry_match_candidate' => true,
            'automatic_exemption_granted' => false,
            'review_required' => true,
        ];
    }

    private function approvedListQuery(
        CarbonImmutable $date
    ): Builder {
        $query = RraExemptionList::query();

        return $this->applyApprovedListScope(
            $query,
            $date
        );
    }

    private function applyApprovedListScope(
        Builder $query,
        CarbonImmutable $date
    ): Builder {
        return $query
            ->where('status', 'active')
            ->where('import_status', 'approved')
            ->whereDate(
                'effective_from',
                '<=',
                $date->toDateString()
            )
            ->where(
                static function (
                    Builder $query
                ) use ($date): void {
                    $query
                        ->whereNull('effective_to')
                        ->orWhereDate(
                            'effective_to',
                            '>=',
                            $date->toDateString()
                        );
                }
            );
    }

    private function policy(): array
    {
        return [
            'automatic_exemption_granted' => false,
            'review_required' => true,
            'approved_registry_match_required' => true,
            'category_selection_grants_exemption' => false,
            'fuzzy_match_grants_exemption' => false,
        ];
    }

    private function asOf(
        ?string $value
    ): CarbonImmutable {
        return $value
            ? CarbonImmutable::parse($value)->startOfDay()
            : CarbonImmutable::today();
    }

    private function normalise(
        mixed $value
    ): string {
        $text = Str::lower(
            Str::ascii(
                trim((string) ($value ?? ''))
            )
        );

        $text = preg_replace(
            '/[^a-z0-9]+/',
            ' ',
            $text
        );

        return trim(
            preg_replace(
                '/\s+/',
                ' ',
                $text
            )
        );
    }
}
