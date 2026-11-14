import type { QuantityPromotion } from '../types/domain';

export async function fetchQuantityPromotion(): Promise<QuantityPromotion | null> {
  try {
    const response = await fetch('/api/promotions/quantity');
    if (!response.ok) return null;
    const data = await response.json();
    return data.promotion || null;
  } catch {
    return null;
  }
}

export function calculateQuantityPromotion(
  promotion: QuantityPromotion | null,
  subtotalPiasters: number,
  itemCount: number,
  lowestUnitPricePiasters: number
) {
  if (!promotion?.active || itemCount < promotion.minItems) {
    return { discountPiasters: 0, freeShipping: false, qualifies: false };
  }
  if (promotion.rewardType === 'free_shipping') {
    return { discountPiasters: 0, freeShipping: true, qualifies: true };
  }
  if (promotion.rewardType === 'free_item') {
    return { discountPiasters: Math.min(subtotalPiasters, lowestUnitPricePiasters), freeShipping: false, qualifies: true };
  }
  if (promotion.rewardType === 'percentage') {
    return { discountPiasters: Math.floor(subtotalPiasters * promotion.value / 100), freeShipping: false, qualifies: true };
  }
  return { discountPiasters: Math.min(subtotalPiasters, promotion.value), freeShipping: false, qualifies: true };
}
