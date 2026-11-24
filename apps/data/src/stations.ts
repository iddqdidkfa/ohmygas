import { detectNetwork, nearestRegion, type Station } from '@ohmygas/shared';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ukraine's bounding box is split into small tiles so every Overpass query is cheap and can be retried alone. */
export interface Tile { id: string; s: number; w: number; n: number; e: number }
const BOUNDS = { s: 44.3, w: 22.1, n: 52.4, e: 40.3 };
// Each Overpass query costs ~40s however small it is, so keep the tile count low.
const ROWS = 2;
const COLS = 3;
export const TILES: Tile[] = Array.from({ length: ROWS * COLS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const dLat = (BOUNDS.n - BOUNDS.s) / ROWS;
  const dLng = (BOUNDS.e - BOUNDS.w) / COLS;
  return {
    id: `${r}-${c}`,
    s: BOUNDS.s + r * dLat,
    n: BOUNDS.s + (r + 1) * dLat,
    w: BOUNDS.w + c * dLng,
    e: BOUNDS.w + (c + 1) * dLng,
  };
});

/** Half-open membership so a station belongs to exactly one tile. */
export const inTile = (t: Tile, lat: number, lng: number) =>
  lat >= t.s && (lat < t.n || (t.n === BOUNDS.n && lat <= t.n)) && lng >= t.w && (lng < t.e || (t.e === BOUNDS.e && lng <= t.e));

const tileQuery = (t: Tile) => `[out:json][timeout:85];
area["ISO3166-1"="UA"][admin_level=2]->.a;
nwr["amenity"="fuel"](area.a)(${t.s},${t.w},${t.n},${t.e});
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
      lat: Math.round(lat * 1e6) / 1e6, // ~0.1 m, plenty for a map
      lng: Math.round(lng * 1e6) / 1e6,
      address: address || undefined,
      region: nearestRegion(lat, lng),
    });
  }
  return out;
}

async function fetchTile(t: Tile, attempts = 2): Promise<Station[]> {
  let last: Error = new Error('no attempts');
  for (let attempt = 0; attempt < attempts; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length]!;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'ohmygas/0.1 (price monitor)' },
        body: new URLSearchParams({ data: tileQuery(t) }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
      const json = (await res.json()) as { elements: OsmElement[]; remark?: string };
      // Overpass answers 200 with an empty list and a "remark" when its own query times out
      if (json.remark && /error|timed out|timeout|out of memory/i.test(json.remark)) throw new Error(`overpass remark: ${json.remark}`);
      return parseOverpass(json.elements);
    } catch (e) {
      last = e as Error;
      // a timeout means the tile is too heavy: let the caller split it instead of repeating the same query
      if (last.name === 'TimeoutError' || last.message.startsWith('overpass remark')) throw last;
      await sleep(5_000);
    }
  }
  throw last;
}

export interface TiledResult { stations: Station[]; failed: Tile[]; done: Tile[] }

/** Splits a tile in two along its longer side. */
export function splitTile(t: Tile): [Tile, Tile] {
  const tall = (t.n - t.s) * 1.5 >= t.e - t.w; // ~1.5 km per degree of longitude vs latitude at this latitude
  if (tall) {
    const m = (t.s + t.n) / 2;
    return [{ ...t, id: t.id + 'a', n: m }, { ...t, id: t.id + 'b', s: m }];
  }
  const m = (t.w + t.e) / 2;
  return [{ ...t, id: t.id + 'a', e: m }, { ...t, id: t.id + 'b', w: m }];
}

/** Fetches a tile; if it keeps failing (usually a timeout on a dense tile) it is split and retried in halves. */
async function fetchAdaptive(t: Tile, depth: number, deadline: number, log: (m: string) => void): Promise<TiledResult> {
  if (Date.now() > deadline) return { stations: [], failed: [t], done: [] };
  try {
    const got = await fetchTile(t);
    log(`tile ${t.id}: ${got.length}`);
    return { stations: got, failed: [], done: [t] };
  } catch (e) {
    log(`tile ${t.id} failed: ${(e as Error).message}`);
    if (depth >= 2) return { stations: [], failed: [t], done: [] };
    const out: TiledResult = { stations: [], failed: [], done: [] };
    for (const half of splitTile(t)) {
      await sleep(1_000);
      const r = await fetchAdaptive(half, depth + 1, deadline, log);
      out.stations.push(...r.stations);
      out.failed.push(...r.failed);
      out.done.push(...r.done);
    }
    return out;
  }
}

/** Fetches the given tiles sequentially (polite to the public servers). Tiles not done by the deadline count as failed. */
export async function fetchStationsTiled(
  deadline: number,
  tiles: Tile[] = TILES,
  log: (m: string) => void = console.log,
): Promise<TiledResult> {
  const byId = new Map<string, Station>();
  const failed: Tile[] = [];
  const done: Tile[] = [];
  for (const t of tiles) {
    const r = await fetchAdaptive(t, 0, deadline, log);
    for (const st of r.stations) byId.set(st.id, st); // ways near tile edges can appear in two tiles
    failed.push(...r.failed);
    done.push(...r.done);
    await sleep(1_000);
  }
  return { stations: [...byId.values()], failed, done };
}

/** New data wins inside the tiles that were refreshed; everywhere else the previous stations are kept. */
export function mergeWithOld(fresh: Station[], old: Station[], refreshed: Tile[]): Station[] {
  const byId = new Map(fresh.map((s) => [s.id, s]));
  for (const s of old) {
    if (!byId.has(s.id) && !refreshed.some((t) => inTile(t, s.lat, s.lng))) byId.set(s.id, s);
  }
  return [...byId.values()];
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
