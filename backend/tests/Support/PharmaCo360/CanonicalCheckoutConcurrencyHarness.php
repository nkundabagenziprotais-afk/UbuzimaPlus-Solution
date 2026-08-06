<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\PharmaCo360\SalesDispensingController;
use App\Models\PharmacoPosSession;
use App\Models\PharmacoSale;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\StockBatch;
use App\Models\StockLocation;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Access\ScopeResolver;
use App\Services\Audit\AuditLogService;
use App\Services\PharmaCo360\AtomicPosCheckoutService;
use App\Services\PharmaCo360\PosMultiBatchCheckoutAllocator;
use Carbon\Carbon;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

if ($argc < 6) {
    fwrite(STDERR, "Usage: harness <mode> <backend> <autoload> <database> <context> [args...]\n");
    exit(2);
}

[$script, $mode, $backend, $autoload, $database, $contextPath] = array_pad($argv, 6, null);
$backend = rtrim((string) $backend, '/');

foreach ([
    'APP_BASE_PATH' => $backend,
    'APP_ENV' => 'testing',
    'APP_DEBUG' => 'false',
    'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => (string) $database,
    'CACHE_STORE' => 'array',
    'CACHE_DRIVER' => 'array',
    'SESSION_DRIVER' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array',
    'BCRYPT_ROUNDS' => '4',
] as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

require $autoload;

spl_autoload_register(static function (string $class) use ($backend): void {
    foreach (['App\\' => $backend . '/app/', 'Database\\' => $backend . '/database/'] as $prefix => $directory) {
        if (! str_starts_with($class, $prefix)) {
            continue;
        }

        $path = $directory . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($path)) {
            require_once $path;
        }
        return;
    }
}, true, true);

$app = require $backend . '/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

config([
    'database.default' => 'sqlite',
    'database.connections.sqlite.database' => $database,
    'database.connections.sqlite.options' => [PDO::ATTR_TIMEOUT => 30],
    'pharmaco.business_timezone' => 'Africa/Kigali',
]);

DB::purge('sqlite');
DB::reconnect('sqlite');
DB::statement('PRAGMA busy_timeout = 30000');
DB::statement('PRAGMA foreign_keys = ON');

Carbon::setTestNow(Carbon::parse('2026-08-04 14:00:00', 'Africa/Kigali'));

function writeJson(string $path, array $payload): void
{
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (file_put_contents($path, $json) !== strlen($json)) {
        throw new RuntimeException("Unable to write {$path}.");
    }
}

function fixtureProduct(Tenant $tenant, ProductCategory $category, StockLocation $location, string $suffix): array
{
    $product = Product::query()->create([
        'uuid' => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'product_category_id' => $category->id,
        'name' => "WPA Concurrency {$suffix}",
        'generic_name' => 'Concurrency fixture',
        'sku' => "WPA-CONCURRENCY-{$suffix}",
        'unit' => 'unit',
        'selling_unit' => 'unit',
        'base_unit' => 'unit',
        'quantity_per_selling_unit' => 1,
        'allow_other_quantity' => true,
        'default_pos_quantity_mode' => 'selling_unit',
        'product_type' => 'medicine',
        'regulatory_status' => 'approved',
        'requires_prescription' => false,
        'is_controlled' => false,
        'reorder_level' => 0,
        'minimum_stock_level' => 0,
        'status' => 'active',
    ]);

    $batch = StockBatch::query()->create([
        'uuid' => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'branch_id' => $location->branch_id,
        'stock_location_id' => $location->id,
        'product_id' => $product->id,
        'batch_number' => "WPA-CONCURRENCY-{$suffix}-BATCH",
        'expiry_date' => '2026-08-20',
        'received_at' => '2026-08-01',
        'quantity_on_hand' => 10,
        'quantity_reserved' => 0,
        'unit_cost' => 700.25,
        'selling_price' => 1500,
        'status' => 'active',
    ]);

    return [$product, $batch];
}

function fixtureSession(Tenant $tenant, User $user, int $branchId, string $terminal, int $sequence): PharmacoPosSession
{
    return PharmacoPosSession::query()->create([
        'uuid' => (string) Str::uuid(),
        'tenant_id' => $tenant->id,
        'branch_id' => $branchId,
        'user_id' => $user->id,
        'business_date' => '2026-08-04',
        'session_mode' => 'live',
        'terminal_identifier' => $terminal,
        'terminal_label' => 'Concurrency Test',
        'sequence_number' => $sequence,
        'session_number' => "POS-CONCURRENCY-{$user->id}-{$sequence}",
        'status' => 'open',
        'opening_float_amount' => 0,
        'expected_cash_amount' => 0,
        'opened_at' => Carbon::parse('2026-08-04 14:00:00', 'Africa/Kigali'),
        'metadata' => ['test' => 'application_process_concurrency'],
    ]);
}

if ($mode === 'setup') {
    DB::statement('PRAGMA journal_mode = WAL');
    DB::statement('PRAGMA synchronous = NORMAL');
    Artisan::call('migrate:fresh', ['--force' => true, '--no-interaction' => true]);
    Artisan::call('db:seed', ['--force' => true, '--no-interaction' => true]);

    $tenant = Tenant::query()->where('slug', 'vitapharma')->firstOrFail();
    $user = User::query()->where('email', 'admin@vitapharmaafrica.com')->firstOrFail();
    $category = ProductCategory::query()->where('tenant_id', $tenant->id)->firstOrFail();
    $location = StockLocation::query()->where('tenant_id', $tenant->id)->where('status', 'active')->firstOrFail();

    [$shortageProduct, $shortageBatch] = fixtureProduct($tenant, $category, $location, 'SHORTAGE');
    [$sameProduct, $sameBatch] = fixtureProduct($tenant, $category, $location, 'SAME-KEY');

    $base = (int) PharmacoPosSession::query()
        ->where('tenant_id', $tenant->id)
        ->where('user_id', $user->id)
        ->whereDate('business_date', '2026-08-04')
        ->max('sequence_number');

    $shortageA = fixtureSession($tenant, $user, (int) $location->branch_id, 'process-shortage-a', $base + 1);
    $shortageB = fixtureSession($tenant, $user, (int) $location->branch_id, 'process-shortage-b', $base + 2);
    $same = fixtureSession($tenant, $user, (int) $location->branch_id, 'process-same-key', $base + 3);

    writeJson((string) $contextPath, [
        'shortage' => [
            'mode' => 'different_keys',
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'branch_id' => $location->branch_id,
            'product_id' => $shortageProduct->id,
            'batch_id' => $shortageBatch->id,
            'sessions' => [
                ['id' => $shortageA->id, 'terminal' => $shortageA->terminal_identifier],
                ['id' => $shortageB->id, 'terminal' => $shortageB->terminal_identifier],
            ],
            'keys' => ['process-shortage-a', 'process-shortage-b'],
            'references' => ['PROCESS-SHORTAGE-A', 'PROCESS-SHORTAGE-B'],
        ],
        'same_key' => [
            'mode' => 'same_key',
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'branch_id' => $location->branch_id,
            'product_id' => $sameProduct->id,
            'batch_id' => $sameBatch->id,
            'sessions' => [['id' => $same->id, 'terminal' => $same->terminal_identifier]],
            'keys' => ['process-same-key'],
            'references' => ['PROCESS-SAME-KEY'],
        ],
    ]);

    exit(0);
}

$context = json_decode((string) file_get_contents((string) $contextPath), true, 512, JSON_THROW_ON_ERROR);

if ($mode === 'checkout') {
    if ($argc !== 11) {
        exit(2);
    }

    $scenarioName = $argv[6];
    $worker = $argv[7];
    $barrier = $argv[8];
    $ready = $argv[9];
    $resultPath = $argv[10];

    writeJson($ready, ['pid' => getmypid(), 'ready_at_ns' => hrtime(true)]);
    $deadline = microtime(true) + 20;
    while (! is_file($barrier)) {
        if (microtime(true) >= $deadline) {
            throw new RuntimeException('Concurrency barrier timed out.');
        }
        usleep(10000);
    }

    $scenario = $context[$scenarioName];
    $index = $worker === 'A' ? 0 : 1;
    $slot = $scenario['mode'] === 'same_key' ? 0 : $index;
    $session = $scenario['sessions'][$slot];
    $key = $scenario['keys'][$slot];
    $reference = $scenario['references'][$slot];
    $started = hrtime(true);

    try {
        $tenant = Tenant::query()->findOrFail($scenario['tenant_id']);
        $user = User::query()->findOrFail($scenario['user_id']);
        $request = Request::create('/api/v1/pharmaco/sales/checkout', 'POST', [
            'idempotency_key' => $key,
            'branch_id' => $scenario['branch_id'],
            'pos_session_id' => $session['id'],
            'terminal_identifier' => $session['terminal'],
            'sale_type' => 'cash_sale',
            'items' => [[
                'product_id' => $scenario['product_id'],
                'quantity' => 7,
                'unit_price' => 1500,
                'pricing_policy' => 'highest_affected_batch_price',
                'discount_amount' => 0,
                'tax_amount' => 0,
                'stock_batch_id' => $scenario['batch_id'],
                'prescription_verified' => false,
            ]],
            'payment' => [
                'payment_method' => 'cash',
                'generate_receipt' => false,
                'reference_number' => $reference,
            ],
        ]);
        $request->headers->set('Accept', 'application/json');
        $request->attributes->set('tenant', $tenant);
        $request->setUserResolver(static fn (): User => $user);

        $response = app(SalesDispensingController::class)->checkoutSale(
            $request,
            app(AuditLogService::class),
            app(ScopeResolver::class),
            app(AtomicPosCheckoutService::class),
            app(PosMultiBatchCheckoutAllocator::class)
        );

        $body = $response->getData(true);
        $result = [
            'worker' => $worker,
            'pid' => getmypid(),
            'outcome' => 'checkout',
            'status' => $response->getStatusCode(),
            'idempotent' => (bool) ($body['idempotent'] ?? false),
            'sale_id' => (int) data_get($body, 'sale.id'),
            'payment_id' => (int) data_get($body, 'payment.id'),
        ];
    } catch (ValidationException $exception) {
        $result = [
            'worker' => $worker,
            'pid' => getmypid(),
            'outcome' => 'shortage',
            'status' => 422,
            'errors' => $exception->errors(),
        ];
    } catch (Throwable $exception) {
        $chain = [];
        for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
            $entry = [
                'exception' => $current::class,
                'message' => $current->getMessage(),
                'code' => $current->getCode(),
            ];
            if ($current instanceof QueryException) {
                $entry['error_info'] = $current->errorInfo;
            }
            $chain[] = $entry;
        }

        $result = [
            'worker' => $worker,
            'pid' => getmypid(),
            'outcome' => 'error',
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
            'exception_chain' => $chain,
        ];
    }

    $result['started_at_ns'] = $started;
    $result['finished_at_ns'] = hrtime(true);
    writeJson($resultPath, $result);
    exit(0);
}

if ($mode === 'inspect') {
    if ($argc !== 7) {
        exit(2);
    }

    $inspection = [];
    foreach (['shortage', 'same_key'] as $scenarioName) {
        $scenario = $context[$scenarioName];
        $sales = PharmacoSale::query()
            ->where('tenant_id', $scenario['tenant_id'])
            ->whereIn('pos_checkout_key', $scenario['keys'])
            ->get();

        $paymentCount = 0;
        $salesLinked = true;
        $paymentsLinked = true;
        foreach ($sales as $sale) {
            $payments = $sale->payments()->get();
            $paymentCount += $payments->count();
            $salesLinked = $salesLinked && $sale->pos_session_id !== null;
            foreach ($payments as $payment) {
                $paymentsLinked = $paymentsLinked && (int) $payment->pos_session_id === (int) $sale->pos_session_id;
            }
        }

        $batch = StockBatch::query()->findOrFail($scenario['batch_id']);
        $movements = StockMovement::query()
            ->where('product_id', $scenario['product_id'])
            ->where('movement_type', 'sale_dispensed')
            ->get();

        $inspection[$scenarioName] = [
            'sale_count' => $sales->count(),
            'payment_count' => $paymentCount,
            'movement_count' => $movements->count(),
            'quantity_on_hand' => (float) $batch->quantity_on_hand,
            'quantity_reserved' => (float) $batch->quantity_reserved,
            'available_quantity' => (float) $batch->quantity_on_hand - (float) $batch->quantity_reserved,
            'all_sales_session_linked' => $salesLinked,
            'all_payments_session_linked' => $paymentsLinked,
            'all_movements_session_linked' => $movements->every(static fn (StockMovement $movement): bool => $movement->pos_session_id !== null),
        ];
    }

    writeJson($argv[6], $inspection);
    exit(0);
}

exit(2);
