<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DataLayerController extends Controller
{
    private array $technicalTables = [
        'cache',
        'cache_locks',
        'failed_jobs',
        'job_batches',
        'jobs',
        'migrations',
        'password_reset_tokens',
        'personal_access_tokens',
        'sessions',
    ];

    public function schema(): JsonResponse
    {
        $tables = collect(Schema::getTables())
            ->map(fn (array $table) => $table['name'] ?? $table['table'] ?? null)
            ->filter()
            ->sort()
            ->map(function (string $table) {
                $columns = collect(Schema::getColumns($table))
                    ->map(fn (array $column) => [
                        'name' => $column['name'],
                        'type' => $column['type_name'] ?? $column['type'] ?? 'unknown',
                        'nullable' => (bool) ($column['nullable'] ?? true),
                    ])
                    ->values();

                return [
                    'name' => $table,
                    'columns' => $columns,
                    'row_count' => $this->safeCount($table),
                    'editable' => $this->isEditableTable($table),
                    'relationships' => $columns
                        ->filter(fn (array $column) => str_ends_with($column['name'], '_id') && $column['name'] !== 'id')
                        ->map(fn (array $column) => [
                            'column' => $column['name'],
                            'hint' => Str::beforeLast($column['name'], '_id'),
                        ])
                        ->values(),
                ];
            })
            ->values();

        return response()->json([
            'tables' => $tables,
            'guardrails' => [
                'technical_tables_read_only' => $this->technicalTables,
                'sql_blocks' => ['drop', 'truncate', 'alter', 'create', 'grant', 'revoke', 'attach', 'detach', 'pragma', 'vacuum'],
                'diagram_source' => 'foreign-key style columns and *_id relationship hints',
            ],
        ]);
    }

    public function rows(Request $request, string $table): JsonResponse
    {
        $this->assertValidTable($table, editableRequired: false);

        $limit = min(max((int) $request->query('limit', 50), 1), 100);
        $offset = max((int) $request->query('offset', 0), 0);

        $rows = DB::table($table)
            ->orderBy($this->primarySortColumn($table), 'desc')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->values();

        return response()->json([
            'table' => $table,
            'editable' => $this->isEditableTable($table),
            'columns' => Schema::getColumnListing($table),
            'rows' => $rows,
            'limit' => $limit,
            'offset' => $offset,
            'total_rows' => $this->safeCount($table),
        ]);
    }

    public function updateRow(
        Request $request,
        string $table,
        int $id,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $this->assertValidTable($table, editableRequired: true);

        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1'],
        ]);

        $columns = collect(Schema::getColumnListing($table));
        $blockedColumns = ['id', 'uuid', 'created_at', 'updated_at', 'deleted_at'];
        $values = collect($validated['values'])
            ->filter(fn ($value, string $key) => $columns->contains($key) && ! in_array($key, $blockedColumns, true))
            ->all();

        if ($values === []) {
            throw ValidationException::withMessages([
                'values' => ['No editable columns were provided.'],
            ]);
        }

        if ($columns->contains('updated_at')) {
            $values['updated_at'] = now();
        }

        $updated = DB::table($table)->where('id', $id)->update($values);

        $auditLogService->record(
            action: 'data_layer.row.updated',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'table' => $table,
                'row_id' => $id,
                'columns' => array_keys($values),
            ],
            dataClassification: 'confidential'
        );

        return response()->json([
            'message' => $updated ? 'Row updated.' : 'No matching row was updated.',
            'updated' => (bool) $updated,
            'row' => DB::table($table)->where('id', $id)->first(),
        ]);
    }

    public function deleteRow(
        Request $request,
        string $table,
        int $id,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $this->assertValidTable($table, editableRequired: true);

        try {
            $deleted = DB::table($table)->where('id', $id)->delete();
        } catch (QueryException $exception) {
            throw ValidationException::withMessages([
                'row' => ['This row cannot be deleted because related records still depend on it.'],
            ]);
        }

        $auditLogService->record(
            action: 'data_layer.row.deleted',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'table' => $table,
                'row_id' => $id,
                'deleted' => (bool) $deleted,
            ],
            dataClassification: 'confidential'
        );

        return response()->json([
            'message' => $deleted ? 'Row deleted.' : 'No matching row was deleted.',
            'deleted' => (bool) $deleted,
        ]);
    }

    public function runSql(
        Request $request,
        AuditLogService $auditLogService,
        ScopeResolver $scopeResolver
    ): JsonResponse {
        $validated = $request->validate([
            'sql' => ['required', 'string', 'max:20000'],
        ]);

        $statements = collect(explode(';', $validated['sql']))
            ->map(fn (string $statement) => trim($statement))
            ->filter()
            ->values();

        if ($statements->isEmpty()) {
            throw ValidationException::withMessages(['sql' => ['Enter at least one SQL statement.']]);
        }

        if ($statements->count() > 8) {
            throw ValidationException::withMessages(['sql' => ['Run no more than 8 statements at a time.']]);
        }

        $results = [];

        foreach ($statements as $statement) {
            $this->assertAllowedSql($statement);

            if (preg_match('/^\s*select\b/i', $statement)) {
                $results[] = [
                    'type' => 'select',
                    'rows' => collect(DB::select($statement))
                        ->take(100)
                        ->map(fn ($row) => (array) $row)
                        ->values(),
                    'limited_to' => 100,
                ];
            } else {
                DB::statement($statement);
                $results[] = [
                    'type' => 'statement',
                    'status' => 'executed',
                ];
            }
        }

        $auditLogService->record(
            action: 'data_layer.sql.executed',
            scope: $scopeResolver->resolveForUser($request->user()),
            metadata: [
                'statement_count' => $statements->count(),
                'starts_with' => $statements->map(fn (string $statement) => Str::lower(Str::before($statement . ' ', ' ')))->all(),
            ],
            dataClassification: 'restricted'
        );

        return response()->json([
            'message' => 'SQL executed with platform guardrails.',
            'results' => $results,
        ]);
    }

    private function assertAllowedSql(string $statement): void
    {
        if (! preg_match('/^\s*(select|insert|update|delete)\b/i', $statement)) {
            throw ValidationException::withMessages([
                'sql' => ['Only SELECT, INSERT, UPDATE, and DELETE statements are allowed here.'],
            ]);
        }

        if (preg_match('/\b(drop|truncate|alter|create|grant|revoke|attach|detach|pragma|vacuum)\b/i', $statement)) {
            throw ValidationException::withMessages([
                'sql' => ['Destructive schema or server-level SQL is blocked from the browser console.'],
            ]);
        }

        foreach ($this->technicalTables as $table) {
            if (preg_match('/\b' . preg_quote($table, '/') . '\b/i', $statement)) {
                throw ValidationException::withMessages([
                    'sql' => ["SQL against {$table} is blocked from the browser console."],
                ]);
            }
        }
    }

    private function assertValidTable(string $table, bool $editableRequired): void
    {
        if (! preg_match('/^[A-Za-z0-9_]+$/', $table) || ! Schema::hasTable($table)) {
            abort(404);
        }

        if ($editableRequired && ! $this->isEditableTable($table)) {
            throw ValidationException::withMessages([
                'table' => ['This table is visible but not editable from the browser Data Layer.'],
            ]);
        }
    }

    private function isEditableTable(string $table): bool
    {
        return ! in_array($table, $this->technicalTables, true)
            && Schema::hasColumn($table, 'id');
    }

    private function safeCount(string $table): int
    {
        try {
            return (int) DB::table($table)->count();
        } catch (\Throwable) {
            return 0;
        }
    }

    private function primarySortColumn(string $table): string
    {
        if (Schema::hasColumn($table, 'created_at')) {
            return 'created_at';
        }

        return Schema::hasColumn($table, 'id') ? 'id' : Schema::getColumnListing($table)[0];
    }
}
