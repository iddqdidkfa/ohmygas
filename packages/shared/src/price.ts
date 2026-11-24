import type { Discount } from './types';

/** Price per litre after the user's personal discount, rounded to kopecks. */
export function effectivePrice(price: number, discount?: Discount): number {
  if (!discount || !(discount.value > 0)) return round2(price);
  const raw =
    discount.kind === 'percent' ? price * (1 - Math.min(discount.value, 100) / 100) : price - discount.value;
  return round2(Math.max(0, raw));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
