import { describe, expect, it } from 'vitest';

import { formatClock, shiftClock, toHHMM } from './clock';

describe('clock', () => {
  it('normalizes Postgres times', () => {
    expect(toHHMM('19:00:00')).toBe('19:00');
  });

  it('formats minutes of the day', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(23 * 60 + 30)).toBe('23:30');
  });

  it('wraps around midnight in both directions', () => {
    expect(shiftClock('23:30', 30)).toBe('00:00');
    expect(shiftClock('00:00', -30)).toBe('23:30');
  });
});
