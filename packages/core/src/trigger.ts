// The heart of the product: decides whether a mission may be sent to a couple right now.
// Pure function of its inputs; the Edge Functions load the state and call it.

import {
  type ClockTime,
  DAY_BOUNDARY_HOUR,
  dayKey,
  endOfDay,
  isWithinWindow,
  parseClockTime,
  toLocal,
} from './time.ts';

export type TriggerSource = 'manual' | 'auto';

export interface CoupleSettings {
  /** IANA time zone, e.g. "Europe/Lisbon". */
  timezone: string;
  windowStart: ClockTime;
  windowEnd: ClockTime;
  /** Minutes of continuous phone use (both partners) before an automatic trigger. */
  usageThresholdMin: number;
  /** Quiet period after each mission. */
  silencePeriodMin: number;
  maxMissionsPerNight: number;
}

export const DEFAULT_SETTINGS: Omit<CoupleSettings, 'timezone'> = {
  windowStart: '19:00',
  windowEnd: '23:30',
  usageThresholdMin: 20,
  silencePeriodMin: 60,
  maxMissionsPerNight: 2,
};

export interface PartnerState {
  /** "Hoje não": no missions until this instant. */
  snoozedUntil: Date | null;
  /** System Do Not Disturb, as reported by the device (Phase 2; always false in Phase 1). */
  doNotDisturb: boolean;
  /**
   * Minutes of continuous phone use, computed on the device (Phase 2). Only an aggregate number,
   * never app names or content. Null when unknown.
   */
  continuousUsageMin: number | null;
}

export interface TriggerInput {
  now: Date;
  source: TriggerSource;
  settings: CoupleSettings;
  partners: readonly [PartnerState, PartnerState];
  /** Whether both phones are on the same home network (Phase 2). Ignored for manual triggers. */
  together: boolean;
  /** Send times of the couple's previous missions (any order). */
  previousRuns: readonly Date[];
}

export type BlockReason =
  | 'snoozed'
  | 'do_not_disturb'
  | 'night_limit_reached'
  | 'silence_period'
  | 'outside_window'
  | 'not_together'
  | 'usage_below_threshold';

export interface TriggerDecision {
  allowed: boolean;
  /** Every condition that failed. Never shown to the partner: the app shows a generic message. */
  reasons: BlockReason[];
}

/**
 * Decides whether a mission can be sent now.
 *
 * Always enforced (manual and automatic): neither partner said "hoje não" or is in Do Not
 * Disturb, the night's mission limit is not reached, and the couple is not in the silence period.
 *
 * Only for automatic triggers: inside the couple's time window, both together, and both in
 * continuous use for at least the threshold. A manual "Estamos aborrecidos" is an explicit request
 * from the couple, so it is not limited to the window.
 */
export function evaluateTrigger(input: TriggerInput): TriggerDecision {
  const { now, settings, partners } = input;
  const reasons: BlockReason[] = [];

  if (partners.some((p) => p.snoozedUntil !== null && p.snoozedUntil > now)) {
    reasons.push('snoozed');
  }
  if (partners.some((p) => p.doNotDisturb)) reasons.push('do_not_disturb');

  const today = dayKey(now, settings.timezone);
  const runsToday = input.previousRuns.filter((r) => dayKey(r, settings.timezone) === today);
  if (runsToday.length >= settings.maxMissionsPerNight) reasons.push('night_limit_reached');

  const lastRun = latest(input.previousRuns);
  if (lastRun && now.getTime() < silenceEndsAt(lastRun, settings).getTime()) {
    reasons.push('silence_period');
  }

  if (input.source === 'auto') {
    const local = toLocal(now, settings.timezone);
    if (!isWithinWindow(local.hour * 60 + local.minute, settings.windowStart, settings.windowEnd)) {
      reasons.push('outside_window');
    }
    if (!input.together) reasons.push('not_together');
    if (
      partners.some(
        (p) => p.continuousUsageMin === null || p.continuousUsageMin < settings.usageThresholdMin,
      )
    ) {
      reasons.push('usage_below_threshold');
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

export function silenceEndsAt(lastRun: Date, settings: CoupleSettings): Date {
  return new Date(lastRun.getTime() + settings.silencePeriodMin * 60_000);
}

/** "Hoje não" lasts for the rest of the app day, i.e. until the next 05:00 local time. */
export function snoozeUntil(now: Date, timezone: string): Date {
  return endOfDay(now, timezone);
}

/** Both partners must opt in to a level: the couple gets the lower of the two. */
export function effectiveLevel(levelA: number, levelB: number): number {
  return Math.min(levelA, levelB);
}

/** Returns problems with couple settings; an empty list means they are valid. */
export function validateSettings(settings: CoupleSettings): string[] {
  const problems: string[] = [];
  let start: number;
  let end: number;
  try {
    start = parseClockTime(settings.windowStart);
    end = parseClockTime(settings.windowEnd);
  } catch (error) {
    return [(error as Error).message];
  }
  if (start === end) return ['the window cannot start and end at the same time'];
  // The night counter resets at the day boundary, so a window may not run across it.
  const boundary = DAY_BOUNDARY_HOUR * 60;
  const crossesBoundary =
    start < end ? start < boundary && end > boundary : start < boundary || end > boundary;
  if (crossesBoundary) {
    problems.push(`the window cannot include ${String(DAY_BOUNDARY_HOUR).padStart(2, '0')}:00`);
  }
  if (!Number.isInteger(settings.maxMissionsPerNight) || settings.maxMissionsPerNight < 1) {
    problems.push('maxMissionsPerNight must be a positive integer');
  }
  if (settings.silencePeriodMin < 0) problems.push('silencePeriodMin cannot be negative');
  if (settings.usageThresholdMin < 0) problems.push('usageThresholdMin cannot be negative');
  return problems;
}

function latest(dates: readonly Date[]): Date | undefined {
  let result: Date | undefined;
  for (const d of dates) if (!result || d > result) result = d;
  return result;
}
