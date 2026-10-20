import { describe, expect, it } from 'vitest';

import { dayKey, endOfDay, fromLocal, isWithinWindow, parseClockTime, toLocal } from './time.ts';

const LISBON = 'Europe/Lisbon';
const SAO_PAULO = 'America/Sao_Paulo';

describe('toLocal / fromLocal', () => {
  it('converts summer time in Lisbon (UTC+1)', () => {
    const instant = new Date('2026-07-01T20:30:00Z');
    expect(toLocal(instant, LISBON)).toEqual({
      year: 2026,
      month: 7,
      day: 1,
      hour: 21,
      minute: 30,
    });
    expect(fromLocal(toLocal(instant, LISBON), LISBON)).toEqual(instant);
  });

  it('converts winter time in Lisbon (UTC+0)', () => {
    const instant = new Date('2026-12-01T20:30:00Z');
    expect(toLocal(instant, LISBON).hour).toBe(20);
    expect(fromLocal(toLocal(instant, LISBON), LISBON)).toEqual(instant);
  });

  it('works in other time zones', () => {
    const instant = new Date('2026-07-01T23:00:00Z');
    expect(toLocal(instant, SAO_PAULO)).toMatchObject({ day: 1, hour: 20 });
  });

  it('resolves non-existent local times (DST gap) forward', () => {
    // 2026-03-29 01:30 does not exist in Lisbon (01:00 -> 02:00).
    const result = fromLocal({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, LISBON);
    expect(toLocal(result, LISBON).hour).toBe(2);
  });
});

describe('parseClockTime', () => {
  it('parses HH:MM and Postgres HH:MM:SS', () => {
    expect(parseClockTime('19:00')).toBe(1140);
    expect(parseClockTime('23:30:00')).toBe(1410);
  });

  it.each(['7:00', '24:00', '12:60', 'abc'])('rejects %s', (value) => {
    expect(() => parseClockTime(value)).toThrow();
  });
});

describe('isWithinWindow', () => {
  const at = (hhmm: string) => parseClockTime(hhmm);

  it('handles a same-day window, start inclusive and end exclusive', () => {
    expect(isWithinWindow(at('18:59'), '19:00', '23:30')).toBe(false);
    expect(isWithinWindow(at('19:00'), '19:00', '23:30')).toBe(true);
    expect(isWithinWindow(at('23:29'), '19:00', '23:30')).toBe(true);
    expect(isWithinWindow(at('23:30'), '19:00', '23:30')).toBe(false);
  });

  it('handles a window that crosses midnight', () => {
    expect(isWithinWindow(at('21:59'), '22:00', '01:00')).toBe(false);
    expect(isWithinWindow(at('23:00'), '22:00', '01:00')).toBe(true);
    expect(isWithinWindow(at('00:30'), '22:00', '01:00')).toBe(true);
    expect(isWithinWindow(at('01:00'), '22:00', '01:00')).toBe(false);
  });
});

describe('dayKey', () => {
  it('keeps the night together across midnight (day starts at 05:00)', () => {
    // 21:00 and 00:30 local (summer, UTC+1) belong to the same night.
    expect(dayKey(new Date('2026-07-01T20:00:00Z'), LISBON)).toBe('2026-07-01');
    expect(dayKey(new Date('2026-07-01T23:30:00Z'), LISBON)).toBe('2026-07-01');
    expect(dayKey(new Date('2026-07-02T03:59:00Z'), LISBON)).toBe('2026-07-01');
    expect(dayKey(new Date('2026-07-02T04:00:00Z'), LISBON)).toBe('2026-07-02');
  });

  it('handles month and year boundaries', () => {
    expect(dayKey(new Date('2027-01-01T02:00:00Z'), LISBON)).toBe('2026-12-31');
  });
});

describe('endOfDay', () => {
  it('is the next 05:00 local time', () => {
    expect(endOfDay(new Date('2026-07-01T20:00:00Z'), LISBON)).toEqual(
      new Date('2026-07-02T04:00:00Z'),
    );
    expect(endOfDay(new Date('2026-07-02T01:00:00Z'), LISBON)).toEqual(
      new Date('2026-07-02T04:00:00Z'),
    );
  });

  it('accounts for the DST change happening overnight', () => {
    // Night of 24 -> 25 Oct 2026: Lisbon goes from UTC+1 to UTC+0 at 02:00.
    expect(endOfDay(new Date('2026-10-24T21:00:00Z'), LISBON)).toEqual(
      new Date('2026-10-25T05:00:00Z'),
    );
  });
});
