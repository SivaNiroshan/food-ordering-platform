import { describe, expect, it } from 'vitest';
import { canTransition, ORDER_TRANSITIONS, STAFF_ACTIONS } from './orders.state-machine.js';

describe('order state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition('PENDING', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'COMPLETED')).toBe(true);
  });

  it('never allows skipping steps or moving backwards', () => {
    expect(canTransition('PENDING', 'READY')).toBe(false);
    expect(canTransition('READY', 'PREPARING')).toBe(false);
    expect(canTransition('ACCEPTED', 'CANCELLED')).toBe(false);
  });

  it('treats REJECTED, COMPLETED and CANCELLED as final', () => {
    for (const status of ['REJECTED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('only exposes staff actions that the state machine allows', () => {
    for (const { from, to } of Object.values(STAFF_ACTIONS)) {
      expect(canTransition(from, to)).toBe(true);
    }
  });
});
