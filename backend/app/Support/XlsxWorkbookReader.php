<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use RuntimeException;
use ZipArchive;

class XlsxWorkbookReader
{
    private const MAIN_NAMESPACE =
        'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    private const RELATIONSHIP_NAMESPACE =
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    private const PACKAGE_RELATIONSHIP_NAMESPACE =
        'http://schemas.openxmlformats.org/package/2006/relationships';

    private ZipArchive $archive;

    /**
     * @var array<int, string>
     */
    private array $sharedStrings = [];

    /**
     * @var array<string, string>
     */
    private array $sheetTargets = [];

    public function __construct(
        private readonly string $filename
    ) {
        if (! is_file($filename)) {
            throw new RuntimeException(
                "Workbook not found: {$filename}"
            );
        }

        $this->archive = new ZipArchive();

        if ($this->archive->open($filename) !== true) {
            throw new RuntimeException(
                "Unable to open workbook: {$filename}"
            );
        }

        $this->sharedStrings = $this->readSharedStrings();
        $this->sheetTargets = $this->readSheetTargets();
    }

    public function __destruct()
    {
        $this->archive->close();
    }

    /**
     * @return array<int, string>
     */
    public function sheetNames(): array
    {
        return array_keys($this->sheetTargets);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function records(string $sheetName): array
    {
        $rows = $this->rows($sheetName);

        if ($rows === []) {
            return [];
        }

        $headerRowIndex = null;
        $headers = [];

        foreach ($rows as $index => $row) {
            $candidateHeaders = [];

            foreach ($row as $column => $value) {
                $header = trim((string) $value);

                if ($header !== '') {
                    $candidateHeaders[$column] = $header;
                }
            }

            if ($candidateHeaders !== []) {
                $headerRowIndex = $index;
                $headers = $candidateHeaders;

                break;
            }
        }

        if ($headerRowIndex === null) {
            return [];
        }

        $records = [];

        foreach ($rows as $rowIndex => $row) {
            if ($rowIndex <= $headerRowIndex) {
                continue;
            }

            $record = [
                '__row_number' => $rowIndex + 1,
            ];

            $hasValue = false;

            foreach ($headers as $column => $header) {
                $value = $row[$column] ?? null;

                if (
                    $value !== null
                    && trim((string) $value) !== ''
                ) {
                    $hasValue = true;
                }

                $record[$header] = $value;
            }

            if ($hasValue) {
                $records[] = $record;
            }
        }

        return $records;
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    public function rows(string $sheetName): array
    {
        $target = $this->sheetTargets[$sheetName] ?? null;

        if (! $target) {
            throw new RuntimeException(
                "Worksheet not found: {$sheetName}"
            );
        }

        $contents = $this->archive->getFromName($target);

        if ($contents === false) {
            throw new RuntimeException(
                "Unable to read worksheet: {$sheetName}"
            );
        }

        $document = $this->loadDocument($contents);
        $xpath = $this->mainXPath($document);

        $rowNodes = $xpath->query(
            '//main:sheetData/main:row'
        );

        if ($rowNodes === false) {
            throw new RuntimeException(
                "Unable to query worksheet rows: {$sheetName}"
            );
        }

        $rows = [];

        foreach ($rowNodes as $rowNode) {
            if (! $rowNode instanceof DOMElement) {
                continue;
            }

            $rowNumber = $rowNode->hasAttribute('r')
                ? max(1, (int) $rowNode->getAttribute('r'))
                : count($rows) + 1;

            $row = [];

            $cellNodes = $xpath->query(
                './main:c',
                $rowNode
            );

            if ($cellNodes === false) {
                continue;
            }

            foreach ($cellNodes as $cellNode) {
                if (! $cellNode instanceof DOMElement) {
                    continue;
                }

                $reference = $cellNode->getAttribute('r');
                $column = $this->columnNumber($reference);

                if ($column < 1) {
                    continue;
                }

                $row[$column] = $this->cellValue(
                    $cellNode,
                    $xpath
                );
            }

            $rows[$rowNumber - 1] = $row;
        }

        ksort($rows);

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function readSharedStrings(): array
    {
        $contents = $this->archive->getFromName(
            'xl/sharedStrings.xml'
        );

        if ($contents === false) {
            return [];
        }

        $document = $this->loadDocument($contents);
        $xpath = $this->mainXPath($document);

        $itemNodes = $xpath->query('//main:si');

        if ($itemNodes === false) {
            return [];
        }

        $values = [];

        foreach ($itemNodes as $itemNode) {
            $text = '';
            $textNodes = $xpath->query(
                './/main:t',
                $itemNode
            );

            if ($textNodes !== false) {
                foreach ($textNodes as $textNode) {
                    $text .= $textNode->textContent;
                }
            }

            $values[] = $text;
        }

        return $values;
    }

    /**
     * @return array<string, string>
     */
    private function readSheetTargets(): array
    {
        $workbookContents = $this->archive->getFromName(
            'xl/workbook.xml'
        );

        $relationsContents = $this->archive->getFromName(
            'xl/_rels/workbook.xml.rels'
        );

        if (
            $workbookContents === false
            || $relationsContents === false
        ) {
            throw new RuntimeException(
                'The workbook metadata is incomplete.'
            );
        }

        $relationsDocument = $this->loadDocument(
            $relationsContents
        );

        $relationsXPath = new DOMXPath(
            $relationsDocument
        );

        $relationsXPath->registerNamespace(
            'pkg',
            self::PACKAGE_RELATIONSHIP_NAMESPACE
        );

        $relationshipTargets = [];
        $relationshipNodes = $relationsXPath->query(
            '//pkg:Relationship'
        );

        if ($relationshipNodes !== false) {
            foreach ($relationshipNodes as $relationshipNode) {
                if (! $relationshipNode instanceof DOMElement) {
                    continue;
                }

                $relationshipTargets[
                    $relationshipNode->getAttribute('Id')
                ] = $relationshipNode->getAttribute('Target');
            }
        }

        $workbookDocument = $this->loadDocument(
            $workbookContents
        );

        $workbookXPath = $this->mainXPath(
            $workbookDocument
        );

        $sheetNodes = $workbookXPath->query(
            '//main:sheets/main:sheet'
        );

        if ($sheetNodes === false) {
            throw new RuntimeException(
                'Unable to read workbook worksheets.'
            );
        }

        $targets = [];

        foreach ($sheetNodes as $sheetNode) {
            if (! $sheetNode instanceof DOMElement) {
                continue;
            }

            $sheetName = $sheetNode->getAttribute('name');

            $relationshipId = $sheetNode->getAttributeNS(
                self::RELATIONSHIP_NAMESPACE,
                'id'
            );

            $target = $relationshipTargets[
                $relationshipId
            ] ?? null;

            if (! $target) {
                continue;
            }

            $target = ltrim($target, '/');

            if (! str_starts_with($target, 'xl/')) {
                $target = 'xl/'.$target;
            }

            $targets[$sheetName] =
                $this->normalizeArchivePath($target);
        }

        return $targets;
    }

    private function cellValue(
        DOMElement $cell,
        DOMXPath $xpath
    ): mixed {
        $type = $cell->getAttribute('t');

        if ($type === 'inlineStr') {
            return $this->concatenateTextNodes(
                $xpath->query(
                    './/main:is//main:t',
                    $cell
                )
            );
        }

        $valueNode = $xpath->query(
            './main:v',
            $cell
        )?->item(0);

        $raw = $valueNode instanceof DOMNode
            ? $valueNode->textContent
            : '';

        if ($type === 's') {
            return $this->sharedStrings[
                (int) $raw
            ] ?? '';
        }

        if ($type === 'b') {
            return $raw === '1';
        }

        if ($type === 'str') {
            return $raw;
        }

        if ($raw === '') {
            return null;
        }

        if (is_numeric($raw)) {
            return str_contains($raw, '.')
                || stripos($raw, 'e') !== false
                    ? (float) $raw
                    : (int) $raw;
        }

        return $raw;
    }

    private function concatenateTextNodes(
        iterable|false|null $nodes
    ): string {
        if ($nodes === false || $nodes === null) {
            return '';
        }

        $text = '';

        foreach ($nodes as $node) {
            $text .= $node->textContent;
        }

        return $text;
    }

    private function columnNumber(
        string $reference
    ): int {
        if (
            ! preg_match(
                '/^([A-Z]+)/i',
                $reference,
                $matches
            )
        ) {
            return 0;
        }

        $value = 0;

        foreach (
            str_split(
                strtoupper($matches[1])
            )
            as $character
        ) {
            $value =
                ($value * 26)
                + ord($character)
                - 64;
        }

        return $value;
    }

    private function normalizeArchivePath(
        string $path
    ): string {
        $segments = [];

        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);

                continue;
            }

            $segments[] = $segment;
        }

        return implode('/', $segments);
    }

    private function mainXPath(
        DOMDocument $document
    ): DOMXPath {
        $xpath = new DOMXPath($document);

        $xpath->registerNamespace(
            'main',
            self::MAIN_NAMESPACE
        );

        return $xpath;
    }

    private function loadDocument(
        string $contents
    ): DOMDocument {
        $previous = libxml_use_internal_errors(true);

        try {
            $document = new DOMDocument();

            $loaded = $document->loadXML(
                $contents,
                LIBXML_NONET
                | LIBXML_COMPACT
                | LIBXML_NOBLANKS
            );

            if (! $loaded) {
                $errors = array_map(
                    static fn ($error): string =>
                        trim($error->message),
                    libxml_get_errors()
                );

                throw new RuntimeException(
                    'Unable to parse workbook XML: '
                    .implode('; ', $errors)
                );
            }

            return $document;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
