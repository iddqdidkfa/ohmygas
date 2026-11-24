/**
 * Refreshes the static data files consumed by the web app (../../data/*.json).
 * Run by GitHub Actions on a schedule, or locally: npm run update-data
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PriceEntry, Station } from '@ohmygas/shared';
import { fetchMinfin } from './minfin.js';
import { fallbackStations, fetchOverpass } from './stations.js';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data');
const STATIONS_MAX_AGE_MS = 14 * 24 * 3600_000;

interface PricesFile { fetchedAt: string; prices: PriceEntry[] }
interface StationsFile { fetchedAt: string | null; source: 'overpass' | 'fallback'; stations: Station[] }
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
  if (fresh) return console.log(`stations: ${old.stations.length} cached, skipping`);
  try {
    const stations = (await fetchOverpass()).sort((a, b) => a.id.localeCompare(b.id));
    await writeJson('stations.json', { fetchedAt: new Date().toISOString(), source: 'overpass', stations } satisfies StationsFile);
    console.log(`stations: ${stations.length} from Overpass`);
  } catch (e) {
    console.warn(`stations: Overpass failed (${(e as Error).message})`);
    if (!old) {
      await writeJson('stations.json', { fetchedAt: null, source: 'fallback', stations: fallbackStations() } satisfies StationsFile);
      console.warn('stations: wrote offline fallback set');
    }
    throw e;
  }
}

await mkdir(DATA, { recursive: true });
let failed = false;
for (const [name, job] of [['prices', updatePrices], ['stations', updateStations]] as const) {
  try {
    await job();
  } catch (e) {
    failed = true;
    console.error(`${name} update failed: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
