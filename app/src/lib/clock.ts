import { parseClockTime } from '@icebreaker/core';

const DAY = 24 * 60;

/** "19:00:00" (Postgres) or "19:00" -> "19:00". */
export function toHHMM(value: string): string {
  return formatClock(parseClockTime(value));
}

export function formatClock(minuteOfDay: number): string {
  const m = ((minuteOfDay % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Moves a clock time by `delta` minutes, wrapping around midnight. */
export function shiftClock(value: string, delta: number): string {
  return formatClock(parseClockTime(value) + delta);
}
