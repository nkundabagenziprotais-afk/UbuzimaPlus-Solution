<?php

namespace App\Services\Access;

use Illuminate\Support\Facades\DB;

class ConfigurationService
{
    public function get(string $scopeType, ?int $scopeId, string $key, mixed $default = null): mixed
    {
        $record = DB::table('entity_configurations')
            ->where('scope_type', $scopeType)
            ->where('scope_id', $scopeId)
            ->where('config_key', $key)
            ->where('status', 'active')
            ->first();

        if (! $record) {
            return $default;
        }

        return json_decode($record->config_value, true);
    }

    public function set(string $scopeType, ?int $scopeId, string $key, mixed $value, ?int $configuredBy = null): void
    {
        DB::table('entity_configurations')->updateOrInsert(
            [
                'scope_type' => $scopeType,
                'scope_id' => $scopeId,
                'config_key' => $key,
            ],
            [
                'config_value' => json_encode($value),
                'status' => 'active',
                'configured_by' => $configuredBy,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }
}
