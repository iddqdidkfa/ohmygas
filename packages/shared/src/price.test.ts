import { describe, expect, it } from 'vitest';
import { effectivePrice } from './price';
import { detectNetwork } from './networks';

describe('effectivePrice', () => {
  it('returns price when no discount', () => expect(effectivePrice(55.5)).toBe(55.5));
  it('applies percent', () => expect(effectivePrice(50, { kind: 'percent', value: 10 })).toBe(45));
  it('applies fixed', () => expect(effectivePrice(50, { kind: 'fixed', value: 1.5 })).toBe(48.5));
  it('never goes negative', () => expect(effectivePrice(1, { kind: 'fixed', value: 5 })).toBe(0));
});

describe('detectNetwork', () => {
  it('matches latin and cyrillic', () => {
    expect(detectNetwork('OKKO')).toBe('okko');
    expect(detectNetwork(undefined, 'АЗС ВОГ')).toBe('wog');
    expect(detectNetwork('Unknown')).toBe('other');
  });
});
