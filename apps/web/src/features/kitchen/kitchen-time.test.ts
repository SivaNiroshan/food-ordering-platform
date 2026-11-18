import { describe, expect, it } from 'vitest';
import { dayRange, minutesLeft, timeAgo } from './kitchen-time';

const now = new Date('2026-11-17T10:00:00Z').getTime();

describe('kitchen time helpers', () => {
  it('describes how long ago an order was placed', () => {
    expect(timeAgo('2026-11-17T09:59:30Z', now)).toBe('Just now');
    expect(timeAgo('2026-11-17T09:56:00Z', now)).toBe('4 min ago');
    expect(timeAgo('2026-11-17T09:00:00Z', now)).toBe('1 h ago');
    expect(timeAgo('2026-11-17T08:55:00Z', now)).toBe('1 h 5 min ago');
  });

  it('counts whole minutes left, never below zero', () => {
    expect(minutesLeft('2026-11-17T10:10:00Z', now)).toBe(10);
    expect(minutesLeft('2026-11-17T10:00:30Z', now)).toBe(1);
    expect(minutesLeft('2026-11-17T09:50:00Z', now)).toBe(0);
  });

  it('turns a calendar day into a 24-hour range', () => {
    const { from, to } = dayRange('2026-11-17');
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(24 * 60 * 60 * 1000);
    expect(new Date(from).getDate()).toBe(17);
  });
});
