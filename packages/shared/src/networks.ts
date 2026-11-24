import type { Network } from './types';

export const NETWORKS: Network[] = [
  { id: 'wog', name: 'WOG', color: '#00a651', aliases: ['wog', 'вог'] },
  { id: 'okko', name: 'OKKO', color: '#e30613', aliases: ['okko', 'окко'] },
  { id: 'socar', name: 'SOCAR', color: '#0072bc', aliases: ['socar', 'сокар'] },
  { id: 'upg', name: 'UPG', color: '#f7941d', aliases: ['upg', 'упг'] },
  { id: 'klo', name: 'KLO', color: '#0b3d91', aliases: ['klo', 'кло'] },
  { id: 'shell', name: 'Shell', color: '#fbce07', aliases: ['shell', 'шелл'] },
  { id: 'brsm', name: 'БРСМ-Нафта', color: '#7b1fa2', aliases: ['брсм', 'brsm'] },
  { id: 'amic', name: 'AMIC', color: '#00838f', aliases: ['amic', 'аміc', 'амік'] },
  { id: 'glusco', name: 'Glusco', color: '#c2185b', aliases: ['glusco', 'глуско'] },
  { id: 'ukrnafta', name: 'Укрнафта', color: '#1565c0', aliases: ['ukrnafta', 'укрнафта'] },
  { id: 'chipo', name: 'Chipo', color: '#ef6c00', aliases: ['chipo', 'чіпо'] },
  { id: 'marshal', name: 'Marshal', color: '#455a64', aliases: ['marshal', 'маршал'] },
  { id: 'neftek', name: 'Neftek', color: '#6d4c41', aliases: ['neftek', 'нефтек'] },
  { id: 'greenwave', name: 'Green Wave', color: '#2e7d32', aliases: ['green wave', 'грін вейв'] },
  { id: 'grandpetrol', name: 'Grand Petrol', color: '#ad1457', aliases: ['grand petrol'] },
  { id: 'mango', name: 'Mango', color: '#f9a825', aliases: ['mango', 'манго'] },
  { id: 'bvs', name: 'BVS', color: '#283593', aliases: ['bvs', 'бвс'] },
  { id: 'vst', name: 'VST', color: '#00695c', aliases: ['vst', 'встт'] },
  { id: 'other', name: 'Інші', color: '#757575', aliases: [] },
];

export const NETWORK_BY_ID: Record<string, Network> = Object.fromEntries(
  NETWORKS.map((n) => [n.id, n]),
);

/** Map free-form OSM brand/name/operator text to a canonical network id. */
export function detectNetwork(...texts: (string | undefined)[]): string {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return 'other';
  for (const n of NETWORKS) {
    if (n.aliases.some((a) => hay.includes(a))) return n.id;
  }
  return 'other';
}
