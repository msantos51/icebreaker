import { continuousUsageMinutes, isInsideWindow, type ScreenEvent } from '@icebreaker/core';

export interface CoupleWindow {
  timezone: string;
  windowStart: string;
  windowEnd: string;
}

export interface HeartbeatPayload {
  continuousUsageMin: number;
  dnd: boolean;
}

/** How far back screen events are read to find the start of the current session. */
export const SCREEN_EVENTS_LOOKBACK_MS = 6 * 60 * 60_000;

/**
 * What a heartbeat sends: two aggregated numbers, never the events themselves. Null outside the
 * couple's window, where nothing is sent at all.
 */
export function buildHeartbeat(
  now: Date,
  window: CoupleWindow,
  events: readonly ScreenEvent[],
  dnd: boolean,
): HeartbeatPayload | null {
  if (!isInsideWindow(now, window)) return null;
  const since = new Date(now.getTime() - SCREEN_EVENTS_LOOKBACK_MS);
  return { continuousUsageMin: continuousUsageMinutes(events, now, since), dnd };
}
