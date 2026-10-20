// Time-zone helpers built only on Intl, so they run the same in Node, Deno and Hermes.

/** "HH:MM" (24h). Postgres `time` values such as "19:00:00" are accepted too. */
export type ClockTime = string;

export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/**
 * The app's "day" starts at 05:00 local time, so that a night that runs past midnight still
 * counts as the same night ("hoje não" pressed at 00:30 still means "tonight").
 */
export const DAY_BOUNDARY_HOUR = 5;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function toLocal(instant: Date, timeZone: string): LocalDateTime {
  const parts: Record<string, number> = {};
  for (const { type, value } of formatter(timeZone).formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
  };
}

/** Converts a local wall-clock time to an instant. Gaps (DST spring forward) resolve forward. */
export function fromLocal(local: LocalDateTime, timeZone: string): Date {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const first = asUtc - offsetAt(asUtc, timeZone);
  const second = asUtc - offsetAt(first, timeZone);
  if (first === second || offsetAt(second, timeZone) === asUtc - second) return new Date(second);
  // The local time does not exist (DST gap): move forward by the size of the gap.
  return new Date(Math.max(first, second));
}

/** Milliseconds the time zone is ahead of UTC at the given instant. */
function offsetAt(epochMs: number, timeZone: string): number {
  const l = toLocal(new Date(epochMs), timeZone);
  const localAsUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
  return localAsUtc - Math.floor(epochMs / 60_000) * 60_000;
}

export function parseClockTime(value: ClockTime): number {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) throw new Error(`invalid clock time "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`invalid clock time "${value}"`);
  return hours * 60 + minutes;
}

/** Whether a local minute-of-day falls in [start, end). Windows may cross midnight. */
export function isWithinWindow(minuteOfDay: number, start: ClockTime, end: ClockTime): boolean {
  const s = parseClockTime(start);
  const e = parseClockTime(end);
  return s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e;
}

/** Identifies the app "day" an instant belongs to, e.g. "2026-10-20" (see DAY_BOUNDARY_HOUR). */
export function dayKey(instant: Date, timeZone: string): string {
  const local = toLocal(instant, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (local.hour < DAY_BOUNDARY_HOUR) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** The instant the current app "day" ends: the next DAY_BOUNDARY_HOUR in local time. */
export function endOfDay(instant: Date, timeZone: string): Date {
  const local = toLocal(instant, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (local.hour >= DAY_BOUNDARY_HOUR) date.setUTCDate(date.getUTCDate() + 1);
  return fromLocal(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: DAY_BOUNDARY_HOUR,
      minute: 0,
    },
    timeZone,
  );
}
