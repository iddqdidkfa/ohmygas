import { useQuery } from '@tanstack/react-query';
import type { PriceEntry, Station } from '@ohmygas/shared';

// Static JSON written by apps/data (committed in /data, published next to the app).
async function getJson<T>(file: string): Promise<T> {
  const r = await fetch(`data/${file}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  return r.json();
}

interface PricesFile { fetchedAt: string; prices: PriceEntry[] }
interface StationsFile { fetchedAt: string | null; stations: Station[] }

export const useStations = () =>
  useQuery({ queryKey: ['stations'], queryFn: async () => (await getJson<StationsFile>('stations.json')).stations });

export const usePricesFile = () => useQuery({ queryKey: ['prices'], queryFn: () => getJson<PricesFile>('prices.json') });

export const usePrices = () => {
  const q = usePricesFile();
  return { ...q, data: q.data?.prices };
};
