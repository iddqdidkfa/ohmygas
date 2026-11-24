export const FUEL_TYPES = ['A95', 'A95_PLUS', 'A92', 'DIESEL', 'LPG'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  A92: 'А-92',
  A95: 'А-95',
  A95_PLUS: 'А-95 Преміум',
  DIESEL: 'Дизель',
  LPG: 'Газ (автогаз)',
};

export interface Network {
  id: string;
  name: string;
  color: string;
  /** lowercase aliases matched against OSM brand/name/operator tags */
  aliases: string[];
}

export interface Station {
  id: string;
  networkId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  region: string;
}

export interface PriceEntry {
  networkId: string;
  fuel: FuelType;
  /** UAH per litre */
  price: number;
  /** optional per-station override */
  stationId?: string;
  updatedAt: string;
  source: string;
}

export type DiscountKind = 'percent' | 'fixed';

export interface Discount {
  kind: DiscountKind;
  /** percent: 0..100, fixed: UAH per litre */
  value: number;
}
