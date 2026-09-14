<?php

namespace App\Services\Hrm\Payroll;

use RuntimeException;
use ZipArchive;

class IshemaUnifiedAnnexureWriter
{
    public const TEMPLATE_CODE =
        'RW_ISHEMA_UNIFIED_ANNEXURE';

    public const TEMPLATE_VERSION =
        'RRA_TAX_HANDBOOK_2025_R1';

    public const HEADERS = [
        'Family Name',
        'Another name',
        'RSSB Number',
        'NID or Passport',
        'Employee Category',
        'Is Employee A Rama Member?',
        'Employee Pays Pension?',
        'Employee Pays Mat Leave?',
        'Employee Pays CBHI?',
        'Basic Salary',
        'Benefit in Kind Transport',
        'Benefit in Kind House',
        'Benefit in Kind Others',
        'Lump sum Transport',
        'Other Medical Deductions',
        'Terminal Benefit End Contract',
        'Retirement Benefits',
        'Ejo-Heza Contribution',
        'Other Pension Funds',
    ];

    public function write(
        string $path,
        array $rows
    ): void {
        $directory =
            dirname($path);

        if (
            ! is_dir($directory)
            &&
            ! mkdir(
                $directory,
                0770,
                true
            )
            &&
            ! is_dir($directory)
        ) {
            throw new RuntimeException(
                'Unable to create Ishema export directory.'
            );
        }

        $zip =
            new ZipArchive();

        $opened =
            $zip->open(
                $path,
                ZipArchive::CREATE
                |
                ZipArchive::OVERWRITE
            );

        if ($opened !== true) {
            throw new RuntimeException(
                'Unable to create Ishema XLSX workbook.'
            );
        }

        try {
            $zip->addFromString(
                '[Content_Types].xml',
                $this->contentTypes()
            );

            $zip->addFromString(
                '_rels/.rels',
                $this->rootRelationships()
            );

            $zip->addFromString(
                'docProps/app.xml',
                $this->appProperties()
            );

            $zip->addFromString(
                'docProps/core.xml',
                $this->coreProperties()
            );

            $zip->addFromString(
                'xl/workbook.xml',
                $this->workbook()
            );

            $zip->addFromString(
                'xl/_rels/workbook.xml.rels',
                $this->workbookRelationships()
            );

            $zip->addFromString(
                'xl/styles.xml',
                $this->styles()
            );

            $zip->addFromString(
                'xl/worksheets/sheet1.xml',
                $this->worksheet($rows)
            );
        } finally {
            $zip->close();
        }

        if (
            ! is_file($path)
            ||
            filesize($path) === 0
        ) {
            throw new RuntimeException(
                'Ishema XLSX workbook was not created.'
            );
        }
    }

    private function worksheet(
        array $rows
    ): string {
        $sheetRows = [];

        $headerCells = [];

        foreach (
            self::HEADERS
            as $index => $header
        ) {
            $headerCells[] =
                $this->inlineCell(
                    $index + 1,
                    1,
                    $header,
                    1
                );
        }

        $sheetRows[] =
            '<row r="1">'
            . implode('', $headerCells)
            . '</row>';

        foreach (
            array_values($rows)
            as $rowIndex => $row
        ) {
            $excelRow =
                $rowIndex + 2;

            $cells = [];

            foreach (
                self::HEADERS
                as $columnIndex => $header
            ) {
                $value =
                    $row[$header]
                    ?? '';

                $column =
                    $columnIndex + 1;

                if (
                    $column >= 10
                    &&
                    is_numeric($value)
                ) {
                    $cells[] =
                        $this->numericCell(
                            $column,
                            $excelRow,
                            (float) $value
                        );
                } else {
                    $cells[] =
                        $this->inlineCell(
                            $column,
                            $excelRow,
                            (string) $value
                        );
                }
            }

            $sheetRows[] =
                '<row r="'
                . $excelRow
                . '">'
                . implode('', $cells)
                . '</row>';
        }

        $lastColumn =
            $this->columnName(
                count(self::HEADERS)
            );

        $lastRow =
            count($rows) + 1;

        $columnDefinitions =
            [
                1 => 22,
                2 => 24,
                3 => 18,
                4 => 22,
                5 => 18,
                6 => 24,
                7 => 22,
                8 => 24,
                9 => 20,
            ];

        $columns = [];

        foreach (
            range(
                1,
                count(self::HEADERS)
            )
            as $column
        ) {
            $width =
                $columnDefinitions[$column]
                ?? 20;

            $columns[] =
                '<col min="'
                . $column
                . '" max="'
                . $column
                . '" width="'
                . $width
                . '" customWidth="1"/>';
        }

        return
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetViews><sheetView workbookViewId="0">'
            . '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
            . '</sheetView></sheetViews>'
            . '<sheetFormatPr defaultRowHeight="15"/>'
            . '<cols>'
            . implode('', $columns)
            . '</cols>'
            . '<sheetData>'
            . implode('', $sheetRows)
            . '</sheetData>'
            . '<autoFilter ref="A1:'
            . $lastColumn
            . $lastRow
            . '"/>'
            . '</worksheet>';
    }

    private function inlineCell(
        int $column,
        int $row,
        string $value,
        int $style = 0
    ): string {
        return
            '<c r="'
            . $this->columnName($column)
            . $row
            . '" t="inlineStr" s="'
            . $style
            . '"><is><t xml:space="preserve">'
            . $this->xml($value)
            . '</t></is></c>';
    }

    private function numericCell(
        int $column,
        int $row,
        float $value
    ): string {
        $numeric =
            number_format(
                $value,
                2,
                '.',
                ''
            );

        return
            '<c r="'
            . $this->columnName($column)
            . $row
            . '" s="2"><v>'
            . $numeric
            . '</v></c>';
    }

    private function columnName(
        int $number
    ): string {
        $name = '';

        while ($number > 0) {
            $number--;

            $name =
                chr(
                    65
                    +
                    ($number % 26)
                )
                . $name;

            $number =
                intdiv(
                    $number,
                    26
                );
        }

        return $name;
    }

    private function xml(
        string $value
    ): string {
        return htmlspecialchars(
            $value,
            ENT_XML1
            |
            ENT_QUOTES,
            'UTF-8'
        );
    }

    private function contentTypes(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
XML;
    }

    private function rootRelationships(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
XML;
    }

    private function workbook(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Unified Annexure" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>
XML;
    }

    private function workbookRelationships(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
XML;
    }

    private function styles(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>
XML;
    }

    private function appProperties(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>UbuzimaPlus</Application>
</Properties>
XML;
    }

    private function coreProperties(): string
    {
        $created =
            gmdate(
                'Y-m-d\TH:i:s\Z'
            );

        return
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<cp:coreProperties '
            . 'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            . 'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            . 'xmlns:dcterms="http://purl.org/dc/terms/" '
            . 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            . '<dc:creator>UbuzimaPlus</dc:creator>'
            . '<cp:lastModifiedBy>UbuzimaPlus</cp:lastModifiedBy>'
            . '<dcterms:created xsi:type="dcterms:W3CDTF">'
            . $created
            . '</dcterms:created>'
            . '<dcterms:modified xsi:type="dcterms:W3CDTF">'
            . $created
            . '</dcterms:modified>'
            . '</cp:coreProperties>';
    }
}

