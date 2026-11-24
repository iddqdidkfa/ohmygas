import { describe, expect, it } from 'vitest';
import { TILES, inTile, mergeWithOld, parseOverpass, splitTile } from './stations.js';

describe('parseOverpass', () => {
  const out = parseOverpass([
    { type: 'node', id: 1, lat: 50.45, lon: 30.52, tags: { brand: 'WOG', 'addr:street': 'Хрещатик' } },
    { type: 'way', id: 2, center: { lat: 49.84, lon: 24.03 }, tags: { name: 'ОККО' } },
    { type: 'relation', id: 3, tags: { brand: 'Shell' } },
  ]);
  it('skips elements without coordinates', () => expect(out).toHaveLength(2));
  it('detects network and uses way centre', () => {
    expect(out[0]?.networkId).toBe('wog');
    expect(out[1]).toMatchObject({ id: 'w2', networkId: 'okko', lat: 49.84, lng: 24.03 });
  });
});

describe('tiles', () => {
  const st = (id: string, lat: number, lng: number) => ({ id, networkId: 'wog', name: id, lat, lng, region: 'x' });
  it('assigns every point to exactly one tile', () => {
    for (const [lat, lng] of [[50.45, 30.52], [44.3, 22.1], [52.4, 40.3], [48.4, 31.2]] as const) {
      expect(TILES.filter((t) => inTile(t, lat, lng))).toHaveLength(1);
    }
  });
  it('replaces old stations only inside refreshed tiles', () => {
    const lvivTile = TILES.find((t) => inTile(t, 49.84, 24.03))!;
    const old = [st('old-kyiv', 50.45, 30.52), st('old-lviv', 49.84, 24.03)];
    const fresh = [st('new-lviv', 49.84, 24.03)];
    const ids = mergeWithOld(fresh, old, [lvivTile]).map((s) => s.id).sort();
    expect(ids).toEqual(['new-lviv', 'old-kyiv']);
  });
});

describe('splitTile', () => {
  it('halves cover the parent without overlap', () => {
    const parent = TILES[3]!;
    const [a, b] = splitTile(parent);
    const pts: [number, number][] = [[parent.s + 0.1, parent.w + 0.1], [parent.n - 0.1, parent.e - 0.1], [(parent.s + parent.n) / 2, (parent.w + parent.e) / 2]];
    for (const [lat, lng] of pts) expect([a, b].filter((x) => inTile(x, lat, lng))).toHaveLength(1);
  });
});
