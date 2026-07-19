export type PosQuantityCalculationInput = {
  sellingUnitQuantity: number;
  otherQuantity: number;
  quantityPerSellingUnit: number;
  sellingUnitPrice: number;
};

export type PosQuantityCalculation = {
  sellingUnitQuantity: number;
  otherQuantity: number;
  quantityPerSellingUnit: number;
  convertedSellingUnitQuantity: number;
  totalBaseQuantity: number;
  baseUnitPrice: number;
  systemBaseUnitPrice: number;
  sellingUnitSubtotal: number;
  otherQuantitySubtotal: number;
  totalPrice: number;
};

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculatePosQuantity(
  input: PosQuantityCalculationInput,
): PosQuantityCalculation {
  const sellingUnitQuantity = nonNegative(input.sellingUnitQuantity);
  const otherQuantity = nonNegative(input.otherQuantity);
  const quantityPerSellingUnit = Math.max(
    0.0001,
    nonNegative(input.quantityPerSellingUnit) || 1,
  );
  const sellingUnitPrice = nonNegative(input.sellingUnitPrice);

  const convertedSellingUnitQuantity =
    sellingUnitQuantity * quantityPerSellingUnit;

  const totalBaseQuantity =
    convertedSellingUnitQuantity + otherQuantity;

  const baseUnitPrice =
    sellingUnitPrice / quantityPerSellingUnit;

  const sellingUnitSubtotal =
    sellingUnitQuantity * sellingUnitPrice;

  const otherQuantitySubtotal =
    otherQuantity * baseUnitPrice;

  return {
    sellingUnitQuantity,
    otherQuantity,
    quantityPerSellingUnit,
    convertedSellingUnitQuantity,
    totalBaseQuantity,
    baseUnitPrice,
    systemBaseUnitPrice: baseUnitPrice,
    sellingUnitSubtotal,
    otherQuantitySubtotal,
    totalPrice: sellingUnitSubtotal + otherQuantitySubtotal,
  };
}
