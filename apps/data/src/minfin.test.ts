import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMinfin } from './minfin.js';

const html = readFileSync(new URL('../test/fixtures/minfin-tm.html', import.meta.url), 'utf8');

describe('parseMinfin', () => {
  const prices = parseMinfin(html);
  const get = (n: string, f: string) => prices.find((p) => p.networkId === n && p.fuel === f);

  it('parses AMIC row with comma decimals', () => {
    expect(get('amic', 'A95_PLUS')?.price).toBe(83.96);
    expect(get('amic', 'A95')?.price).toBe(80.96);
    expect(get('amic', 'DIESEL')?.price).toBe(96.9);
    expect(get('amic', 'LPG')?.price).toBe(63.24);
  });
  it('skips empty cells', () => expect(get('amic', 'A92')).toBeUndefined());
  it('maps Cyrillic ОККО and reads date', () => {
    expect(get('okko', 'A95')).toBeDefined();
    expect(prices[0]?.updatedAt.slice(0, 10)).toBe('2026-11-24');
  });
  it('ignores unknown operators', () => expect(prices.every((p) => p.networkId !== 'other')).toBe(true));
  it('throws on a changed layout', () => expect(() => parseMinfin('<html></html>')).toThrow());
});
