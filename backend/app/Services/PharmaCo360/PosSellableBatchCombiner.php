<?php

namespace App\Services\PharmaCo360;

/**
 * Combines serialized sellable stock batches for the existing POS UI.
 *
 * The earliest FEFO batch remains the representative batch ID sent
 * by the client. Checkout subsequently performs the authoritative,
 * transaction-locked allocation across the real underlying batches.
 */
final class PosSellableBatchCombiner
{
    /**
     * @param array<int, array<string, mixed>> $batches
     * @return array<int, array<string, mixed>>
     */
    public function combine(array $batches): array
    {
        usort(
            $batches,
            fn (array $left, array $right): int =>
                $this->compareFefo($left, $right)
        );

        $combinedByProductAndBranch = [];

        foreach ($batches as $batch) {
            $productId = (int) (
                $batch['product']['id']
                ?? $batch['product_id']
                ?? 0
            );

            $branchId = (int) (
                $batch['branch']['id']
                ?? $batch['branch_id']
                ?? 0
            );

            $batchId = (int) ($batch['id'] ?? 0);

            /*
             * Never merge a malformed batch with another record.
             */
            if ($productId <= 0) {
                $combinedByProductAndBranch[
                    'batch:' . $batchId
                ] = $batch;

                continue;
            }

            $key = $productId . ':' . $branchId;

            if (! isset($combinedByProductAndBranch[$key])) {
                $metadata = is_array($batch['metadata'] ?? null)
                    ? $batch['metadata']
                    : [];

                $metadata['pos_combined_batch_ids'] = [$batchId];
                $metadata['pos_combined_batch_count'] = 1;
                $metadata['pos_combined_by'] =
                    'product_and_branch_fefo';

                $batch['quantity_on_hand'] = $this->number(
                    $batch['quantity_on_hand'] ?? 0
                );

                $batch['quantity_reserved'] = $this->number(
                    $batch['quantity_reserved'] ?? 0
                );

                $batch['available_quantity'] = $this->number(
                    $batch['available_quantity'] ?? 0
                );

                $batch['amount'] = $this->number(
                    $batch['amount'] ?? 0
                );

                $batch['metadata'] = $metadata;

                $combinedByProductAndBranch[$key] = $batch;

                continue;
            }

            $combined =
                $combinedByProductAndBranch[$key];

            foreach (
                [
                    'quantity_on_hand',
                    'quantity_reserved',
                    'available_quantity',
                    'amount',
                ] as $field
            ) {
                $combined[$field] =
                    $this->number($combined[$field] ?? 0)
                    + $this->number($batch[$field] ?? 0);
            }

            $metadata = is_array($combined['metadata'] ?? null)
                ? $combined['metadata']
                : [];

            $batchIds = is_array(
                $metadata['pos_combined_batch_ids'] ?? null
            )
                ? $metadata['pos_combined_batch_ids']
                : [];

            if (! in_array($batchId, $batchIds, true)) {
                $batchIds[] = $batchId;
            }

            $metadata['pos_combined_batch_ids'] =
                array_values($batchIds);

            $metadata['pos_combined_batch_count'] =
                count($batchIds);

            $metadata['pos_combined_by'] =
                'product_and_branch_fefo';

            $combined['metadata'] = $metadata;

            $combinedByProductAndBranch[$key] = $combined;
        }

        return array_values($combinedByProductAndBranch);
    }

    /**
     * @param array<string, mixed> $left
     * @param array<string, mixed> $right
     */
    private function compareFefo(
        array $left,
        array $right
    ): int {
        $leftExpiry = $this->dateKey(
            $left['expiry_date'] ?? null
        );

        $rightExpiry = $this->dateKey(
            $right['expiry_date'] ?? null
        );

        $expiryComparison =
            $leftExpiry <=> $rightExpiry;

        if ($expiryComparison !== 0) {
            return $expiryComparison;
        }

        $leftReceived = $this->dateKey(
            $left['received_at'] ?? null
        );

        $rightReceived = $this->dateKey(
            $right['received_at'] ?? null
        );

        $receivedComparison =
            $leftReceived <=> $rightReceived;

        if ($receivedComparison !== 0) {
            return $receivedComparison;
        }

        return (int) ($left['id'] ?? 0)
            <=> (int) ($right['id'] ?? 0);
    }

    private function dateKey(mixed $value): string
    {
        $date = trim((string) ($value ?? ''));

        return $date !== ''
            ? $date
            : '9999-12-31 23:59:59';
    }

    private function number(mixed $value): float
    {
        $number = (float) $value;

        return is_finite($number)
            ? max(0, $number)
            : 0;
    }
}
