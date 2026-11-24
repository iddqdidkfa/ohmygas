/**
 * Refreshes the static data files consumed by the web app (../../data/*.json).
 * Run by GitHub Actions on a schedule, or locally: npm run update-data
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PriceEntry, Station } from '@ohmygas/shared';
import { fetchMinfin } from './minfin.js';
import { TILES, fallbackStations, fetchStationsTiled, mergeWithOld, type Tile } from './stations.js';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data');
const STATIONS_MAX_AGE_MS = 14 * 24 * 3600_000;

interface PricesFile { fetchedAt: string; prices: PriceEntry[] }
interface StationsFile {
  fetchedAt: string | null;
  source: 'overpass' | 'partial' | 'fallback';
  /** tiles still to fetch after a partial run (next run resumes only these) */
  pending?: Tile[];
  stations: Station[];
}
/** "networkId:FUEL" -> [[YYYY-MM-DD, price], ...] */
type History = Record<string, [string, number][]>;

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(resolve(DATA, name), 'utf8')) as T;
  } catch {
    return null;
  }
}
const writeJson = (name: string, data: unknown) => writeFile(resolve(DATA, name), JSON.stringify(data) + '\n');

export function mergeHistory(history: History, prices: PriceEntry[]): History {
  for (const p of prices) {
    const key = `${p.networkId}:${p.fuel}`;
    const day = p.updatedAt.slice(0, 10);
    const series = (history[key] ??= []);
    const last = series[series.length - 1];
    if (last && last[0] === day) last[1] = p.price;
    else series.push([day, p.price]);
  }
  return history;
}

async function updatePrices() {
  const prices = await fetchMinfin();
  await writeJson('prices.json', { fetchedAt: new Date().toISOString(), prices } satisfies PricesFile);
  const history = mergeHistory((await readJson<History>('history.json')) ?? {}, prices);
  await writeJson('history.json', history);
  console.log(`prices: ${prices.length} entries from minfin`);
}

async function updateStations() {
  const old = await readJson<StationsFile>('stations.json');
  const fresh = old?.source === 'overpass' && old.fetchedAt && Date.now() - Date.parse(old.fetchedAt) < STATIONS_MAX_AGE_MS;
  if (fresh && !old.pending?.length) return console.log(`stations: ${old.stations.length} cached, skipping`);

  // Resume unfinished tiles from a previous partial run; otherwise refresh everything.
  const resuming = !!old?.pending?.length;
  const tiles = resuming ? old!.pending! : TILES;
  const { stations: got, failed, done } = await fetchStationsTiled(Date.now() + 8 * 60_000, tiles);
  const sort = (l: Station[]) => l.sort((a, b) => a.id.localeCompare(b.id));
  const usableOld = old && old.source !== 'fallback' ? old.stations : [];
  // a first-time or full refresh that fully succeeds replaces everything; otherwise merge into what we have
  const stations = sort(mergeWithOld(got, usableOld, resuming || failed.length ? done : TILES));

  if (!failed.length) {
    await writeJson('stations.json', { fetchedAt: new Date().toISOString(), source: 'overpass', stations } satisfies StationsFile);
    return console.log(`stations: ${stations.length} from Overpass`);
  }

  const summary = `${done.length} tiles ok, ${failed.length} pending: ${failed.map((t) => t.id).join(', ')}`;
  if (stations.length) {
    // Keep a previous complete refresh date so freshness logic still retries; a first fill has none (null) and retries next run.
    const complete = old?.source === 'overpass' && !old.pending?.length;
    await writeJson('stations.json', {
      fetchedAt: complete ? old!.fetchedAt : null,
      source: complete ? 'overpass' : 'partial',
      pending: failed,
      stations,
    } satisfies StationsFile);
    console.warn(`stations: partial, ${stations.length} stations saved (${summary})`);
  } else if (!old) {
    await writeJson('stations.json', { fetchedAt: null, source: 'fallback', stations: fallbackStations() } satisfies StationsFile);
    console.warn('stations: wrote offline fallback set');
  }
  throw new Error(`stations incomplete: ${summary}`);
}

// usage: tsx src/update.ts [prices|stations|all]  (default: all)
const target = process.argv[2] ?? 'all';
const jobs = { prices: updatePrices, stations: updateStations };
if (target !== 'all' && !(target in jobs)) {
  console.error(`unknown target "${target}" (use prices | stations | all)`);
  process.exit(2);
}

await mkdir(DATA, { recursive: true });
let failed = false;
for (const [name, job] of Object.entries(jobs)) {
  if (target !== 'all' && target !== name) continue;
  try {
    await job();
  } catch (e) {
    failed = true;
    console.error(`${name} update failed: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
