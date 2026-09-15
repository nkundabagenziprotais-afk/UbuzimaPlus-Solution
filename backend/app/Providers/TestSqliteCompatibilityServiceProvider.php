<?php

declare(strict_types=1);

namespace App\Providers;

use App\Database\Php83ImmediateSqliteConnection;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

final class TestSqliteCompatibilityServiceProvider
    extends ServiceProvider
{
    public function register(): void
    {
        if (version_compare(PHP_VERSION, '8.4.0', '>=')) {
            return;
        }

        Connection::resolverFor(
            'sqlite',
            static function (
                $connection,
                $database,
                $prefix,
                array $config
            ): Php83ImmediateSqliteConnection {
                return new Php83ImmediateSqliteConnection(
                    $connection,
                    $database,
                    $prefix,
                    $config
                );
            }
        );
    }

    public function boot(): void
    {
        $connection = DB::connection();

        if (
            $connection->getDriverName()
            !== 'sqlite'
        ) {
            return;
        }

        $pdo = $connection->getPdo();

        if (
            ! method_exists(
                $pdo,
                'sqliteCreateFunction'
            )
        ) {
            return;
        }

        /*
         * SQLite's REGEXP operator calls a function
         * named regexp(pattern, value).
         */
        $pdo->sqliteCreateFunction(
            'regexp',
            static function (
                mixed $pattern,
                mixed $value
            ): int {
                $pattern =
                    (string) (
                        $pattern ?? ''
                    );

                $value =
                    (string) (
                        $value ?? ''
                    );

                if ($pattern === '') {
                    return 0;
                }

                $delimiter = '~';

                $safePattern =
                    str_replace(
                        $delimiter,
                        '\\' . $delimiter,
                        $pattern
                    );

                $result =
                    @preg_match(
                        $delimiter
                        . $safePattern
                        . $delimiter
                        . 'i',
                        $value
                    );

                return $result === 1
                    ? 1
                    : 0;
            },
            2
        );

        /*
         * MySQL CONCAT_WS compatibility for TEST SQLite.
         */
        $pdo->sqliteCreateFunction(
            'concat_ws',
            static function (
                mixed ...$arguments
            ): string {
                if ($arguments === []) {
                    return '';
                }

                $separator =
                    (string) array_shift(
                        $arguments
                    );

                $values =
                    array_values(
                        array_filter(
                            $arguments,
                            static fn (
                                mixed $value
                            ): bool =>
                                $value !== null
                        )
                    );

                return implode(
                    $separator,
                    array_map(
                        static fn (
                            mixed $value
                        ): string =>
                            (string) $value,
                        $values
                    )
                );
            },
            -1
        );
    }
}
