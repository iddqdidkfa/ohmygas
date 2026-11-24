import { effectivePrice, type Discount, type FuelType, type PriceEntry } from '@ohmygas/shared';
import { dkey } from '../store/discounts';

export type PriceIndex = Map<string, PriceEntry>;

export function indexPrices(prices: PriceEntry[]): PriceIndex {
  const m: PriceIndex = new Map();
  for (const p of prices) m.set(`${p.stationId ?? ''}|${p.networkId}|${p.fuel}`, p);
  return m;
}

export function lookup(idx: PriceIndex, networkId: string, fuel: FuelType, stationId?: string) {
  return idx.get(`${stationId ?? ''}|${networkId}|${fuel}`) ?? idx.get(`|${networkId}|${fuel}`);
}

/** Base + discounted price for a station/fuel, or null when no data. */
export function priced(
  idx: PriceIndex,
  discounts: Record<string, Discount>,
  networkId: string,
  fuel: FuelType,
  stationId?: string,
) {
  const entry = lookup(idx, networkId, fuel, stationId);
  if (!entry) return null;
  const d = discounts[dkey(networkId, fuel)];
  return { base: entry.price, final: effectivePrice(entry.price, d), discount: d, updatedAt: entry.updatedAt };
}
