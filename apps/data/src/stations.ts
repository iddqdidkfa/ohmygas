import { detectNetwork, nearestRegion, type Station } from '@ohmygas/shared';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const QUERY = `[out:json][timeout:180];
area["ISO3166-1"="UA"][admin_level=2]->.a;
nwr["amenity"="fuel"](area.a);
out center tags;`;

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(elements: OsmElement[]): Station[] {
  const out: Station[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const t = el.tags ?? {};
    const networkId = detectNetwork(t.brand, t['brand:uk'], t.name, t.operator);
    const address = [t['addr:street'], t['addr:housenumber'], t['addr:city']].filter(Boolean).join(', ');
    out.push({
      id: `${el.type[0]}${el.id}`,
      networkId,
      name: t['name:uk'] ?? t.name ?? t.brand ?? 'АЗС',
      lat,
      lng,
      address: address || undefined,
      region: nearestRegion(lat, lng),
    });
  }
  return out;
}

export async function fetchOverpass(): Promise<Station[]> {
  let last: Error = new Error('no endpoints');
  // Overpass is often overloaded: two passes over all mirrors, with a pause between
  for (const url of [...OVERPASS, ...OVERPASS]) {
    if (last.message !== 'no endpoints' && url === OVERPASS[0]) await new Promise((r) => setTimeout(r, 20_000));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'ohmygas/0.1 (price monitor)' },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
      const json = (await res.json()) as { elements: OsmElement[] };
      return parseOverpass(json.elements);
    } catch (e) {
      last = e as Error;
    }
  }
  throw last;
}

// Offline fallback: a few stations around major cities.
const CITIES: [string, number, number][] = [
  ['Київ', 50.45, 30.52], ['Львів', 49.84, 24.03], ['Одеса', 46.48, 30.73], ['Харків', 49.99, 36.23],
  ['Дніпро', 48.46, 35.04], ['Запоріжжя', 47.84, 35.14], ['Вінниця', 49.23, 28.47], ['Полтава', 49.59, 34.55],
  ['Чернігів', 51.5, 31.29], ['Івано-Франківськ', 48.92, 24.71], ['Ужгород', 48.62, 22.29], ['Черкаси', 49.44, 32.06],
];
export function fallbackStations(): Station[] {
  const ids = ['wog', 'okko', 'socar', 'upg', 'klo', 'shell', 'brsm', 'amic', 'glusco'];
  const out: Station[] = [];
  CITIES.forEach(([city, lat, lng], ci) => {
    ids.forEach((networkId, ni) => {
      const a = (ci * 9 + ni) * 2.399;
      const r = 0.03 + ((ni * 7) % 5) * 0.012;
      out.push({
        id: `seed-${ci}-${ni}`,
        networkId,
        name: `${networkId.toUpperCase()} ${city}`,
        lat: lat + Math.sin(a) * r,
        lng: lng + (Math.cos(a) * r) / 0.65,
        address: city,
        region: nearestRegion(lat, lng),
      });
    });
  });
  return out;
}
