<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NormalizeHistoricalPosDate
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! str_contains(strtolower($request->path()), 'api/v1/pharmaco/pos/historical')) {
            return $next($request);
        }

        $fields = [
            'historical_date',
            'session_date',
            'business_date',
            'transaction_date',
            'open_date',
            'date',
        ];

        $data = [];

        foreach ($fields as $field) {
            $value = $request->input($field);

            if (! is_string($value) || $value === '') {
                continue;
            }

            if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $value)) {
                [$month, $day, $year] = explode('-', $value);
                $data[$field] = "{$year}-{$month}-{$day}";
                $data[$field . '_display'] = $value;
            }
        }

        if ($data) {
            $request->merge($data);
        }

        return $next($request);
    }
}
