import type { PharmaStockBatch } from './api';

export type PosFefoPriceTier = {
  batchId: number;
  availableQuantity: number;
  sellingPrice: number;
  expiryDate: string | null;
  receivedAt: string | null;
};

function safeNumber(value: unknown): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? Math.max(0, number)
    : 0;
}

export function extractPosFefoPriceTiers(
  batch: PharmaStockBatch,
): PosFefoPriceTier[] {
  const metadata =
    batch.metadata &&
    typeof batch.metadata === 'object'
      ? batch.metadata
      : {};

  const rawTiers = Array.isArray(
    metadata.pos_fefo_price_tiers,
  )
    ? metadata.pos_fefo_price_tiers
    : [];

  const parsed = rawTiers
    .filter(
      (value): value is Record<string, unknown> =>
        Boolean(value) && typeof value === 'object',
    )
    .map((tier) => ({
      batchId: Number(tier.batch_id ?? 0),
      availableQuantity:
        safeNumber(tier.available_quantity),
      sellingPrice:
        safeNumber(tier.selling_price),
      expiryDate:
        tier.expiry_date
          ? String(tier.expiry_date)
          : null,
      receivedAt:
        tier.received_at
          ? String(tier.received_at)
          : null,
    }))
    .filter(
      (tier) =>
        tier.batchId > 0 &&
        tier.availableQuantity > 0,
    );

  if (parsed.length > 0) {
    return parsed;
  }

  const quantityOnHand =
    safeNumber(batch.quantity_on_hand);

  const quantityReserved =
    safeNumber(batch.quantity_reserved);

  return [
    {
      batchId: Number(batch.id),
      availableQuantity: safeNumber(
        batch.available_quantity
          ?? quantityOnHand - quantityReserved,
      ),
      sellingPrice:
        safeNumber(batch.selling_price),
      expiryDate: batch.expiry_date ?? null,
      receivedAt: batch.received_at ?? null,
    },
  ];
}

export function highestAffectedSellingPrice(
  tiers: PosFefoPriceTier[],
  requestedBaseQuantity: number,
  fallbackSellingPrice: number,
): number {
  let remaining = safeNumber(requestedBaseQuantity);
  let highestPrice = 0;

  for (const tier of tiers) {
    if (remaining <= 0) {
      break;
    }

    const available = safeNumber(
      tier.availableQuantity,
    );

    if (available <= 0) {
      continue;
    }

    const affectedQuantity = Math.min(
      available,
      remaining,
    );

    if (affectedQuantity > 0) {
      highestPrice = Math.max(
        highestPrice,
        safeNumber(tier.sellingPrice),
      );

      remaining = Math.max(
        0,
        remaining - affectedQuantity,
      );
    }
  }

  return highestPrice > 0
    ? highestPrice
    : safeNumber(fallbackSellingPrice);
}


export type PosFefoAllocation =
  PosFefoPriceTier & {
    allocatedQuantity: number;
    affected: boolean;
  };

export function allocatePosFefoBatches(
  tiers: PosFefoPriceTier[],
  requestedBaseQuantity: number,
): PosFefoAllocation[] {
  let remaining = safeNumber(
    requestedBaseQuantity,
  );

  return tiers.map((tier) => {
    const availableQuantity = safeNumber(
      tier.availableQuantity,
    );

    const allocatedQuantity =
      remaining > 0
        ? Math.min(
            availableQuantity,
            remaining,
          )
        : 0;

    remaining = Math.max(
      0,
      remaining - allocatedQuantity,
    );

    return {
      ...tier,
      availableQuantity,
      allocatedQuantity,
      affected: allocatedQuantity > 0,
    };
  });
}
