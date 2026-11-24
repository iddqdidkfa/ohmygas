import * as cheerio from 'cheerio';
import type { FuelType, PriceEntry } from '@ohmygas/shared';

const URL = 'https://index.minfin.com.ua/ua/markets/fuel/tm/';

/** minfin operator name -> our network id. Unlisted operators are ignored. */
const OPERATORS: Record<string, string> = {
  WOG: 'wog', ОККО: 'okko', SOCAR: 'socar', UPG: 'upg', KLO: 'klo', AMIC: 'amic',
  'БРСМ-Нафта': 'brsm', UKRNAFTA: 'ukrnafta', Chipo: 'chipo', Marshal: 'marshal', Neftek: 'neftek',
  'Green Wave': 'greenwave', 'Grand Petrol': 'grandpetrol', Mango: 'mango', BVS: 'bvs', VST: 'vst',
};

const COLUMNS: Record<string, FuelType> = { 'А95+': 'A95_PLUS', А95: 'A95', А92: 'A92', ДП: 'DIESEL', Газ: 'LPG' };

const squash = (s: string) => s.replace(/[\s ]+/g, '');

export function parseMinfin(html: string, fallbackDate = new Date()): PriceEntry[] {
  const $ = cheerio.load(html);
  const table = $('table.zebra').first();
  if (!table.length) throw new Error('minfin: price table not found (layout changed?)');

  const caption = squash(table.find('caption').text());
  const m = caption.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const updatedAt = m ? new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!, 12)).toISOString() : fallbackDate.toISOString();

  // column index -> fuel, from header cells (first column is the operator name)
  const cols: (FuelType | undefined)[] = [];
  table.find('tr').first().find('th').each((_, th) => {
    cols.push(COLUMNS[squash($(th).text())]);
  });
  if (!cols.some(Boolean)) throw new Error('minfin: fuel columns not recognised');

  const out: PriceEntry[] = [];
  table.find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).find('td');
    const networkId = OPERATORS[$(cells[0]).text().trim()];
    if (!networkId) return;
    // some rows carry an extra empty marker cell after the name; align from the right
    const offset = cells.length - cols.length;
    cols.forEach((fuel, i) => {
      if (!fuel) return;
      const raw = $(cells[i + offset]).text().trim().replace(',', '.');
      const price = Number(raw);
      if (raw && Number.isFinite(price) && price > 10 && price < 300) {
        out.push({ networkId, fuel, price, updatedAt, source: 'minfin' });
      }
    });
  });
  if (!out.length) throw new Error('minfin: no prices parsed');
  return out;
}

export async function fetchMinfin(): Promise<PriceEntry[]> {
  const res = await fetch(URL, {
    headers: { 'user-agent': 'ohmygas/0.1 (personal price monitor)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`minfin: HTTP ${res.status}`);
  return parseMinfin(await res.text());
}
