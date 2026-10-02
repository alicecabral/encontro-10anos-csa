export const LOT_CAPACITIES = [40, 40, 43] as const;
export const TOTAL_TICKET_LIMIT = LOT_CAPACITIES.reduce((sum, capacity) => sum + capacity, 0);

export function getLotCapacity(displayOrder: number) {
  return LOT_CAPACITIES[displayOrder - 1] ?? LOT_CAPACITIES[LOT_CAPACITIES.length - 1];
}

export function isLotAvailableByRelease(
  lot: {
    active: boolean;
    displayOrder: number;
    quantitySold: number;
    quantityLimit?: number | null;
  },
  totalSold: number,
) {
  const lotLimit = lot.quantityLimit ?? getLotCapacity(lot.displayOrder);
  if (!lot.active || lot.quantitySold >= lotLimit) return false;
  if (totalSold >= TOTAL_TICKET_LIMIT) return false;

  const soldBeforeThisLot = LOT_CAPACITIES.slice(0, lot.displayOrder - 1).reduce(
    (sum, capacity) => sum + capacity,
    0,
  );
  const maxSoldForThisLot = soldBeforeThisLot + lotLimit;

  return totalSold >= soldBeforeThisLot && totalSold < maxSoldForThisLot;
}

export function graduationYearFromClassOf2016Answer(isClassOf2016: boolean) {
  return isClassOf2016 ? 2016 : null;
}
