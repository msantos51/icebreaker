// Phone usage, computed on the device from screen on/off events only. The events never leave the
// phone: only the resulting numbers are sent to the backend.

import { type ClockTime, isWithinWindow, toLocal } from './time.ts';

export interface ScreenEvent {
  type: 'on' | 'off';
  at: Date;
}

/** Locking the phone for less than this (e.g. to glance at the TV) does not end a session. */
export const SCREEN_OFF_TOLERANCE_MS = 60_000;

interface Session {
  start: number;
  /** null while the screen is still on. */
  end: number | null;
}

/**
 * Builds screen sessions from events, merging sessions separated by less than the tolerance.
 * `since` is the start of the queried period: if the first event is "off", the screen was already
 * on at that point.
 */
function sessions(events: readonly ScreenEvent[], since: Date, toleranceMs: number): Session[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const result: Session[] = [];
  let current: Session | null = null;
  if (sorted[0]?.type === 'off') current = { start: since.getTime(), end: null };

  for (const event of sorted) {
    const t = event.at.getTime();
    if (event.type === 'on') {
      if (current) continue; // duplicate "on"
      const previous = result[result.length - 1];
      if (previous && previous.end !== null && t - previous.end < toleranceMs) {
        result.pop();
        current = { start: previous.start, end: null };
      } else {
        current = { start: t, end: null };
      }
    } else if (current) {
      result.push({ start: current.start, end: t });
      current = null;
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Minutes of continuous use right now: how long the current session has lasted, or 0 if the
 * screen has been off for longer than the tolerance.
 */
export function continuousUsageMinutes(
  events: readonly ScreenEvent[],
  now: Date,
  since: Date,
  toleranceMs = SCREEN_OFF_TOLERANCE_MS,
): number {
  const last = sessions(events, since, toleranceMs).at(-1);
  if (!last) return 0;
  const end = last.end ?? now.getTime();
  if (now.getTime() - end >= toleranceMs) return 0;
  return Math.max(0, Math.floor((now.getTime() - last.start) / 60_000));
}

/** Upper bound for the off-phone metric. */
export const OFFPHONE_CAP_MIN = 120;
/** If the phone is not put down within this time after the mission, it counts as 0 minutes. */
export const PUT_DOWN_WITHIN_MS = 10 * 60_000;
/** Screen-on shorter than this (e.g. a notification lighting the screen) does not end the pause. */
export const GLANCE_MS = 30_000;

export interface OffPhoneResult {
  minutes: number;
  /** False while the phone is still down and the cap was not reached: report later. */
  final: boolean;
}

/**
 * Minutes this phone stayed down after a mission: from the first time the screen goes off after
 * the mission until it is used again (a glance shorter than GLANCE_MS doesn't count), capped at
 * OFFPHONE_CAP_MIN.
 */
export function offPhoneMinutes(
  events: readonly ScreenEvent[],
  missionSentAt: Date,
  now: Date,
): OffPhoneResult {
  const sent = missionSentAt.getTime();
  const sorted = [...events]
    .filter((e) => e.at.getTime() >= sent)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const putDown = sorted.find((e) => e.type === 'off');
  if (!putDown || putDown.at.getTime() - sent > PUT_DOWN_WITHIN_MS) {
    const decided = !!putDown || now.getTime() - sent > PUT_DOWN_WITHIN_MS;
    return { minutes: 0, final: decided };
  }

  const start = putDown.at.getTime();
  const capAt = start + OFFPHONE_CAP_MIN * 60_000;
  const after = sorted.filter((e) => e.at.getTime() > start);
  for (let i = 0; i < after.length; i++) {
    const event = after[i]!;
    if (event.type !== 'on') continue;
    const t = event.at.getTime();
    if (t >= capAt) break;
    const nextOff = after.slice(i + 1).find((e) => e.type === 'off');
    const glanceEnd = nextOff ? nextOff.at.getTime() : now.getTime();
    if (glanceEnd - t >= GLANCE_MS) {
      return { minutes: Math.floor((t - start) / 60_000), final: true };
    }
    if (!nextOff) {
      // Screen on right now, for less than a glance: can't tell yet.
      return { minutes: Math.floor((t - start) / 60_000), final: false };
    }
  }

  if (now.getTime() >= capAt) return { minutes: OFFPHONE_CAP_MIN, final: true };
  return { minutes: Math.floor((now.getTime() - start) / 60_000), final: false };
}

/** Heartbeats are only sent inside the couple's window: less battery, less data. */
export function isInsideWindow(
  now: Date,
  window: { timezone: string; windowStart: ClockTime; windowEnd: ClockTime },
): boolean {
  const local = toLocal(now, window.timezone);
  return isWithinWindow(local.hour * 60 + local.minute, window.windowStart, window.windowEnd);
}

export interface PresenceSignal {
  publicIpHash: string;
  continuousUsageMin: number;
  dnd: boolean;
  updatedAt: Date;
}

/**
 * Background tasks run at most every ~15 minutes on Android, so a heartbeat older than this is
 * stale: the phone may have been put down since.
 */
export const PRESENCE_MAX_AGE_MS = 20 * 60_000;

export function isFresh(signal: PresenceSignal | null, now: Date): signal is PresenceSignal {
  return !!signal && now.getTime() - signal.updatedAt.getTime() <= PRESENCE_MAX_AGE_MS;
}

/** Together = both recently seen behind the same public IP (same home network). */
export function areTogether(
  a: PresenceSignal | null,
  b: PresenceSignal | null,
  now: Date,
): boolean {
  return isFresh(a, now) && isFresh(b, now) && a.publicIpHash === b.publicIpHash;
}

/**
 * Usage as seen by the backend: the last reported value while it is fresh, null otherwise. It is
 * not extrapolated: the phone may have been put down right after reporting. The trigger then fires
 * on whichever heartbeat comes next with both partners above the threshold.
 */
export function reportedUsageMinutes(signal: PresenceSignal | null, now: Date): number | null {
  return isFresh(signal, now) ? signal.continuousUsageMin : null;
}
