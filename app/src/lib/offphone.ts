import { offPhoneMinutes, type ScreenEvent } from '@icebreaker/core';

/** A mission whose off-phone minutes this phone still has to report. */
export interface PendingMeasurement {
  runId: string;
  sentAt: string;
}

/** Matches MEASUREMENT_MAX_AGE_MS in supabase/functions/_shared/presence.ts. */
const MAX_AGE_MS = 3 * 60 * 60_000;

export type MeasurementAction =
  { action: 'report'; minutes: number } | { action: 'wait' } | { action: 'drop' };

/** What the background task should do with a pending measurement right now. */
export function measurementAction(
  pending: PendingMeasurement,
  events: readonly ScreenEvent[],
  now: Date,
): MeasurementAction {
  const sentAt = new Date(pending.sentAt);
  const result = offPhoneMinutes(events, sentAt, now);
  if (result.final) return { action: 'report', minutes: result.minutes };
  if (now.getTime() - sentAt.getTime() > MAX_AGE_MS) return { action: 'drop' };
  return { action: 'wait' };
}
