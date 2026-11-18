import { describe, expect, it } from 'vitest';
import { formatCents, formatPrice, toCents } from './money';

describe('money', () => {
  it('parses decimal strings into integer cents', () => {
    expect(toCents('1200.00')).toBe(120000);
    expect(toCents('1200')).toBe(120000);
    expect(toCents('0.5')).toBe(50);
    expect(toCents('0.29')).toBe(29); // 0.29 * 100 as a float is 28.999999999999996
  });

  it('rejects invalid amounts', () => {
    expect(() => toCents('-5')).toThrow();
    expect(() => toCents('10.999')).toThrow();
    expect(() => toCents('abc')).toThrow();
  });

  it('adds prices without floating-point drift', () => {
    expect(toCents('0.10') + toCents('0.20')).toBe(30);
  });

  it('formats as LKR with thousands separators', () => {
    expect(formatCents(285000)).toBe('LKR 2,850.00');
    expect(formatPrice('150')).toBe('LKR 150.00');
  });
});
