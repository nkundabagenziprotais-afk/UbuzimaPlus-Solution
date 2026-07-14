<?php

namespace Tests\Feature\PharmaCo360;

use App\Models\Product;
use App\Models\ProductDuplicateProposal;
use App\Models\ProductPayerPrice;
use App\Models\ProductReconciliationBatch;
use App\Models\ProductReconciliationRow;
use App\Models\Tenant;
use App\Services\Inventory\ProductSourceImportService;
use App\Support\XlsxWorkbookReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use ZipArchive;

class ProductSourceImportServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_native_reader_reads_shared_string_and_numeric_cells(): void
    {
        $filename = $this->makeWorkbook([
            ['Product Name', 'Price'],
            ['BABY HALER', 12500],
        ]);

        $reader = new XlsxWorkbookReader($filename);
        $records = $reader->records('Sheet1');

        $this->assertCount(1, $records);
        $this->assertSame('BABY HALER', $records[0]['Product Name']);
        $this->assertSame(12500, $records[0]['Price']);
        $this->assertSame(2, $records[0]['__row_number']);
    }

    public function test_sources_are_staged_idempotently_with_separate_payer_prices(): void
    {
        $this->seed();

        $tenant = Tenant::query()
            ->where('slug', 'vitapharma')
            ->firstOrFail();

        $product = Product::query()
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        $drugs = $this->makeWorkbook([
            [
                'SN',
                'DRUG_CODE',
                'GENERIC DESCRIPTION',
                'DESIGNATION',
                'INSTRUCTIONS',
                'SELLING UNIT',
                'PRICE',
            ],
            [
                1,
                $product->sku,
                $product->generic_name,
                $product->name,
                null,
                $product->unit,
                12500,
            ],
        ]);

        $medicines = $this->makeWorkbook([
            ['Product Name', 'Price'],
            [$product->name, 13000],
        ]);

        $reconciliation = $this->makeWorkbook([
            [
                'Candidate Type',
                'Record A Product ID',
                'Record A SKU',
                'Record A Name',
                'Record A Generic',
                'Record A Unit',
                'Record A Inventory Linked',
                'Record A Dependency Rows',
                'Match Basis',
                'Match Score',
                'Record B Product ID',
                'Record B SKU',
                'Record B Name',
                'Record B Generic',
                'Record B Unit',
                'Record B Inventory Linked',
                'Recommended Action',
            ],
        ], 'Duplicate Candidates');

        $service = app(ProductSourceImportService::class);

        $first = $service->stageSources(
            (int) $tenant->id,
            null,
            [
                'drugs' => $drugs,
                'medicines' => $medicines,
                'reconciliation' => $reconciliation,
                'eden' => null,
            ]
        );

        $this->assertSame(3, ProductReconciliationBatch::query()->count());
        $this->assertSame(2, ProductReconciliationRow::query()->count());
        $this->assertSame(2, ProductPayerPrice::query()->count());
        $this->assertSame(0, ProductDuplicateProposal::query()->count());

        $this->assertSame(
            2,
            $first['summary']['rows']
        );

        $second = $service->stageSources(
            (int) $tenant->id,
            null,
            [
                'drugs' => $drugs,
                'medicines' => $medicines,
                'reconciliation' => $reconciliation,
                'eden' => null,
            ]
        );

        $this->assertSame(3, ProductReconciliationBatch::query()->count());
        $this->assertSame(2, ProductReconciliationRow::query()->count());
        $this->assertSame(2, ProductPayerPrice::query()->count());
        $this->assertTrue(
            $second['sources']['drugs']['reused_existing_batch']
        );
        $this->assertTrue(
            $second['sources']['medicines']['reused_existing_batch']
        );
    }

    /**
     * @param array<int, array<int, mixed>> $rows
     */
    private function makeWorkbook(
        array $rows,
        string $sheetName = 'Sheet1'
    ): string {
        $filename = tempnam(
            sys_get_temp_dir(),
            'ubuzima-xlsx-'
        );

        if ($filename === false) {
            $this->fail('Unable to allocate temporary workbook.');
        }

        $xlsx = $filename.'.xlsx';
        rename($filename, $xlsx);

        $shared = [];
        $sharedIndexes = [];

        foreach ($rows as $row) {
            foreach ($row as $value) {
                if (! is_string($value)) {
                    continue;
                }

                if (! array_key_exists($value, $sharedIndexes)) {
                    $sharedIndexes[$value] = count($shared);
                    $shared[] = $value;
                }
            }
        }

        $sheetRows = '';

        foreach ($rows as $rowIndex => $row) {
            $rowNumber = $rowIndex + 1;
            $cells = '';

            foreach ($row as $columnIndex => $value) {
                if ($value === null) {
                    continue;
                }

                $reference = $this->columnName(
                    $columnIndex + 1
                ).$rowNumber;

                if (is_string($value)) {
                    $cells .= sprintf(
                        '<c r="%s" t="s"><v>%d</v></c>',
                        $reference,
                        $sharedIndexes[$value]
                    );
                } else {
                    $cells .= sprintf(
                        '<c r="%s"><v>%s</v></c>',
                        $reference,
                        $value
                    );
                }
            }

            $sheetRows .= sprintf(
                '<row r="%d">%s</row>',
                $rowNumber,
                $cells
            );
        }

        $sharedXml = '';

        foreach ($shared as $value) {
            $sharedXml .= '<si><t>'
                .htmlspecialchars(
                    $value,
                    ENT_XML1 | ENT_QUOTES,
                    'UTF-8'
                )
                .'</t></si>';
        }

        $zip = new ZipArchive();
        $zip->open(
            $xlsx,
            ZipArchive::CREATE | ZipArchive::OVERWRITE
        );

        $zip->addFromString(
            '[Content_Types].xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            .'<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            .'</Types>'
        );

        $zip->addFromString(
            '_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>'
        );

        $zip->addFromString(
            'xl/workbook.xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            .'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets><sheet name="'
            .htmlspecialchars(
                $sheetName,
                ENT_XML1 | ENT_QUOTES,
                'UTF-8'
            )
            .'" sheetId="1" r:id="rId1"/></sheets>'
            .'</workbook>'
        );

        $zip->addFromString(
            'xl/_rels/workbook.xml.rels',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            .'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
            .'</Relationships>'
        );

        $zip->addFromString(
            'xl/sharedStrings.xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            .'count="'.count($shared).'" uniqueCount="'.count($shared).'">'
            .$sharedXml
            .'</sst>'
        );

        $zip->addFromString(
            'xl/worksheets/sheet1.xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<sheetData>'
            .$sheetRows
            .'</sheetData>'
            .'</worksheet>'
        );

        $zip->close();

        return $xlsx;
    }

    private function columnName(int $number): string
    {
        $name = '';

        while ($number > 0) {
            $number--;
            $name = chr(65 + ($number % 26)).$name;
            $number = intdiv($number, 26);
        }

        return $name;
    }
}
