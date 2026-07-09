<?php

namespace App\Services\Payments;

use App\Models\PharmacoMomoParserTemplate;
use Carbon\CarbonImmutable;
use RuntimeException;

class MomoMessageParser
{
    public function parse(
        PharmacoMomoParserTemplate $template,
        string $message
    ): array {
        $pattern = trim($template->message_regex);

        if ($pattern === '') {
            throw new RuntimeException(
                'The Mobile Money parser template is empty.'
            );
        }

        set_error_handler(
            static fn () => true
        );

        try {
            $matched = preg_match(
                $pattern,
                $message,
                $matches
            );
        } finally {
            restore_error_handler();
        }

        if ($matched !== 1) {
            return [
                'status' => 'failed',
                'confidence' => 0,
                'errors' => [
                    'The message did not match the active parser template.',
                ],
                'data' => [],
            ];
        }

        $amount = $this->decimal(
            $matches['amount'] ?? null
        );

        $balance = $this->decimal(
            $matches['balance'] ?? null
        );

        $transactionId = $this->clean(
            $matches['transaction_id'] ?? null
        );

        $dateTime = $this->clean(
            $matches['datetime'] ?? null
        );

        $transactionAt = null;

        if ($dateTime !== null) {
            try {
                $transactionAt =
                    CarbonImmutable::parse(
                        $dateTime,
                        $template->timezone
                            ?: 'Africa/Kigali'
                    )->utc();
            } catch (\Throwable) {
                $transactionAt = null;
            }
        }

        $phone = $this->clean(
            $matches['phone'] ?? null
        );

        $phoneSuffix = $phone
            ? substr(
                preg_replace(
                    '/\D+/',
                    '',
                    $phone
                ) ?: '',
                -6
            )
            : null;

        $required = [
            $amount,
            $transactionId,
            $transactionAt,
        ];

        $availableRequired = count(
            array_filter(
                $required,
                static fn ($value) =>
                    $value !== null
            )
        );

        $confidence = round(
            ($availableRequired / count($required))
            * 100,
            2
        );

        return [
            'status' =>
                $availableRequired ===
                count($required)
                    ? 'parsed'
                    : 'partial',
            'confidence' => $confidence,
            'errors' =>
                $availableRequired ===
                count($required)
                    ? []
                    : [
                        'One or more required fields could not be extracted.',
                    ],
            'data' => [
                'transaction_at' =>
                    $transactionAt,
                'customer_name' =>
                    $this->clean(
                        $matches['customer'] ?? null
                    ),
                'phone_masked' => $phone,
                'phone_suffix' =>
                    $phoneSuffix ?: null,
                'amount' => $amount,
                'currency' =>
                    $this->clean(
                        $matches['currency'] ?? null
                    ) ?? 'RWF',
                'provider_transaction_id' =>
                    $transactionId,
                'balance' => $balance,
                'et_id' =>
                    $this->clean(
                        $matches['et_id'] ?? null
                    ),
            ],
        ];
    }

    public static function defaultRegex(): string
    {
        return <<<'REGEX'
~You\s+have\s+received\s+(?<amount>[\d,]+(?:\.\d+)?)\s*(?<currency>[A-Z]{3})\s+from\s+(?<customer>.+?)\s+\((?<phone>[\d*+]+)\)\s+at\s+(?<datetime>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\.\s*Balance:\s*(?<balance>[\d,]+(?:\.\d+)?)\s*[A-Z]{3}\.\s*FT\s+Id:\s*(?<transaction_id>[^.]+)\.\s*ET\s+Id:\s*(?<et_id>[^.]+)\.~iu
REGEX;
    }

    private function decimal(
        mixed $value
    ): ?float {
        if ($value === null) {
            return null;
        }

        $normalized = str_replace(
            [',', ' '],
            '',
            (string) $value
        );

        if (
            $normalized === '' ||
            ! is_numeric($normalized)
        ) {
            return null;
        }

        return round(
            (float) $normalized,
            2
        );
    }

    private function clean(
        mixed $value
    ): ?string {
        if ($value === null) {
            return null;
        }

        $cleaned = trim(
            preg_replace(
                '/\s+/',
                ' ',
                (string) $value
            ) ?? ''
        );

        return $cleaned !== ''
            ? $cleaned
            : null;
    }
}
