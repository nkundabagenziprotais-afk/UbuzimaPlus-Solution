<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$backendPath = dirname(__DIR__) . '/backend';

if (! file_exists($backendPath . '/vendor/autoload.php')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode([
        'message' => 'Backend dependencies are not installed on the server.',
        'expected' => $backendPath . '/vendor/autoload.php',
    ]);
    exit;
}

if (! file_exists($backendPath . '/bootstrap/app.php')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode([
        'message' => 'Laravel bootstrap file is missing on the server.',
        'expected' => $backendPath . '/bootstrap/app.php',
    ]);
    exit;
}

require $backendPath . '/vendor/autoload.php';

$app = require_once $backendPath . '/bootstrap/app.php';

$kernel = $app->make(Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
);

$response->send();

$kernel->terminate($request, $response);
