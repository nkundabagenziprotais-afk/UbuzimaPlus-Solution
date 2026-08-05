<?php

declare(strict_types=1);

namespace Tests\Feature\PharmaCo360;

use PHPUnit\Framework\TestCase;
use RuntimeException;

final class CanonicalCheckoutProcessConcurrencyTest extends TestCase
{
    private string $directory;
    private string $database;
    private string $context;
    private string $backend;
    private string $autoload;
    private string $php;
    private string $harness;

    protected function setUp(): void
    {
        parent::setUp();

        if (! function_exists('proc_open')) {
            $this->markTestSkipped('proc_open is required.');
        }

        $this->backend = realpath(__DIR__ . '/../../..')
            ?: throw new RuntimeException('Backend path unavailable.');
        $this->autoload = (string) getenv('WPA_VENDOR_AUTOLOAD');
        $this->php = (string) (getenv('WPA_PROCESS_PHP_BIN') ?: PHP_BINARY);
        $this->harness = realpath(
            __DIR__ . '/../../Support/PharmaCo360/CanonicalCheckoutConcurrencyHarness.php'
        ) ?: throw new RuntimeException('Harness unavailable.');

        if (! is_file($this->autoload) || ! is_executable($this->php)) {
            throw new RuntimeException('Concurrency runtime unavailable.');
        }

        $this->directory = sys_get_temp_dir() . '/wpa-concurrency-' . bin2hex(random_bytes(8));
        if (! mkdir($this->directory, 0700, true) && ! is_dir($this->directory)) {
            throw new RuntimeException('Unable to create test directory.');
        }

        $this->database = $this->directory . '/concurrency.sqlite';
        $this->context = $this->directory . '/context.json';
        touch($this->database);

        $setup = $this->runCommand([
            $this->php,
            $this->harness,
            'setup',
            $this->backend,
            $this->autoload,
            $this->database,
            $this->context,
        ]);

        $this->assertSame(0, $setup['exit'], $setup['diagnostic']);
        $this->assertFileExists($this->context);
    }

    protected function tearDown(): void
    {
        if (isset($this->directory) && is_dir($this->directory)) {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($iterator as $item) {
                $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
            }
            rmdir($this->directory);
        }

        parent::tearDown();
    }

    public function test_parallel_checkout_shortage_and_same_key_idempotency(): void
    {
        $shortage = $this->scenario('shortage');
        $this->assertWorkersSucceeded($shortage);

        $outcomes = [$shortage['A']['outcome'], $shortage['B']['outcome']];
        sort($outcomes);
        $this->assertSame(['checkout', 'shortage'], $outcomes, $this->encode($shortage));
        $this->assertOverlap($shortage['A'], $shortage['B']);

        $successful = $shortage['A']['outcome'] === 'checkout' ? $shortage['A'] : $shortage['B'];
        $this->assertSame(201, (int) $successful['status']);
        $this->assertFalse((bool) $successful['idempotent']);

        $same = $this->scenario('same_key');
        $this->assertWorkersSucceeded($same);
        $this->assertSame('checkout', $same['A']['outcome'], $this->encode($same));
        $this->assertSame('checkout', $same['B']['outcome'], $this->encode($same));
        $this->assertOverlap($same['A'], $same['B']);

        $statuses = [(int) $same['A']['status'], (int) $same['B']['status']];
        sort($statuses);
        $this->assertSame([200, 201], $statuses, $this->encode($same));

        $flags = [(bool) $same['A']['idempotent'], (bool) $same['B']['idempotent']];
        sort($flags);
        $this->assertSame([false, true], $flags, $this->encode($same));
        $this->assertSame((int) $same['A']['sale_id'], (int) $same['B']['sale_id']);
        $this->assertSame((int) $same['A']['payment_id'], (int) $same['B']['payment_id']);

        $inspectionPath = $this->directory . '/inspection.json';
        $inspectionRun = $this->runCommand([
            $this->php,
            $this->harness,
            'inspect',
            $this->backend,
            $this->autoload,
            $this->database,
            $this->context,
            $inspectionPath,
        ]);

        $this->assertSame(0, $inspectionRun['exit'], $inspectionRun['diagnostic']);
        $inspection = json_decode(
            (string) file_get_contents($inspectionPath),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        foreach (['shortage', 'same_key'] as $scenario) {
            $state = $inspection[$scenario];
            $this->assertSame(1, $state['sale_count']);
            $this->assertSame(1, $state['payment_count']);
            $this->assertGreaterThanOrEqual(1, $state['movement_count']);
            $this->assertEqualsWithDelta(3, $state['quantity_on_hand'], 0.0001);
            $this->assertEqualsWithDelta(0, $state['quantity_reserved'], 0.0001);
            $this->assertGreaterThanOrEqual(0, $state['available_quantity']);
            $this->assertTrue($state['all_sales_session_linked']);
            $this->assertTrue($state['all_payments_session_linked']);
            $this->assertTrue($state['all_movements_session_linked']);
        }
    }

    private function scenario(string $scenario): array
    {
        $barrier = $this->directory . "/{$scenario}.go";
        $readyA = $this->directory . "/{$scenario}.a.ready";
        $readyB = $this->directory . "/{$scenario}.b.ready";
        $resultA = $this->directory . "/{$scenario}.a.json";
        $resultB = $this->directory . "/{$scenario}.b.json";

        $workerA = $this->startProcess([
            $this->php,
            $this->harness,
            'checkout',
            $this->backend,
            $this->autoload,
            $this->database,
            $this->context,
            $scenario,
            'A',
            $barrier,
            $readyA,
            $resultA,
        ]);
        $workerB = $this->startProcess([
            $this->php,
            $this->harness,
            'checkout',
            $this->backend,
            $this->autoload,
            $this->database,
            $this->context,
            $scenario,
            'B',
            $barrier,
            $readyB,
            $resultB,
        ]);

        $deadline = microtime(true) + 20;
        while (! is_file($readyA) || ! is_file($readyB)) {
            if (microtime(true) >= $deadline) {
                $this->fail('Workers did not reach barrier.');
            }
            usleep(10000);
        }
        touch($barrier);

        $completedA = $this->completeProcess($workerA);
        $completedB = $this->completeProcess($workerB);
        $this->assertFileExists($resultA);
        $this->assertFileExists($resultB);

        $decodedA = json_decode((string) file_get_contents($resultA), true, 512, JSON_THROW_ON_ERROR);
        $decodedB = json_decode((string) file_get_contents($resultB), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(0, $completedA['exit'], $completedA['diagnostic'] . "\n" . $this->encode($decodedA));
        $this->assertSame(0, $completedB['exit'], $completedB['diagnostic'] . "\n" . $this->encode($decodedB));

        return ['A' => $decodedA, 'B' => $decodedB];
    }

    private function assertWorkersSucceeded(array $results): void
    {
        foreach (['A', 'B'] as $worker) {
            $this->assertNotSame(
                'error',
                $results[$worker]['outcome'] ?? null,
                $this->encode($results[$worker])
            );
        }
    }

    private function assertOverlap(array $first, array $second): void
    {
        $latestStart = max((int) $first['started_at_ns'], (int) $second['started_at_ns']);
        $earliestFinish = min((int) $first['finished_at_ns'], (int) $second['finished_at_ns']);
        $this->assertLessThan($earliestFinish, $latestStart);
    }

    private function runCommand(array $command): array
    {
        return $this->completeProcess($this->startProcess($command));
    }

    private function startProcess(array $command): array
    {
        $process = proc_open(
            $command,
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            $this->backend,
            null,
            ['bypass_shell' => true]
        );

        if (! is_resource($process)) {
            throw new RuntimeException('Unable to start worker.');
        }

        fclose($pipes[0]);
        return [
            'process' => $process,
            'stdout' => $pipes[1],
            'stderr' => $pipes[2],
            'command' => $command,
        ];
    }

    private function completeProcess(array $worker): array
    {
        $stdout = stream_get_contents($worker['stdout']);
        $stderr = stream_get_contents($worker['stderr']);
        fclose($worker['stdout']);
        fclose($worker['stderr']);
        $exit = proc_close($worker['process']);

        return [
            'exit' => $exit,
            'diagnostic' => 'Command: '
                . implode(' ', array_map('escapeshellarg', $worker['command']))
                . "\nSTDOUT:\n{$stdout}\nSTDERR:\n{$stderr}",
        ];
    }

    private function encode(mixed $value): string
    {
        return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            ?: 'Unable to encode diagnostic.';
    }
}
