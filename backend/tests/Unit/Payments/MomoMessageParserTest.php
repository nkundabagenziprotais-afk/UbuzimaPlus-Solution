<?php

namespace Tests\Unit\Payments;

use App\Models\PharmacoMomoParserTemplate;
use App\Services\Payments\MomoMessageParser;
use Tests\TestCase;

class MomoMessageParserTest extends TestCase
{
    public function test_standard_momo_message_is_parsed(): void
    {
        $template =
            new PharmacoMomoParserTemplate([
                'message_regex' =>
                    MomoMessageParser::defaultRegex(),
                'timezone' => 'Africa/Kigali',
            ]);

        $result = app(
            MomoMessageParser::class
        )->parse(
            $template,
            'You have received 213200 RWF from VITA PHARMA Ltd Ltd (*********980) at 2026-07-09 08:13:20. Balance: 444607 RWF. FT Id: 29074382317. ET Id: -.'
        );

        $this->assertSame(
            'parsed',
            $result['status']
        );

        $this->assertSame(
            213200.0,
            $result['data']['amount']
        );

        $this->assertSame(
            'RWF',
            $result['data']['currency']
        );

        $this->assertSame(
            'VITA PHARMA Ltd Ltd',
            $result['data']['customer_name']
        );

        $this->assertSame(
            '*********980',
            $result['data']['phone_masked']
        );

        $this->assertSame(
            '980',
            $result['data']['phone_suffix']
        );

        $this->assertSame(
            '29074382317',
            $result['data'][
                'provider_transaction_id'
            ]
        );

        $this->assertSame(
            444607.0,
            $result['data']['balance']
        );

        $this->assertSame(
            '-',
            $result['data']['et_id']
        );
    }
}
