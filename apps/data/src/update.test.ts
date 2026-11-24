import { describe, expect, it } from 'vitest';
import { parseOverpass } from './stations.js';

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
