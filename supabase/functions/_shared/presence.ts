// Heartbeat handling: validates what a phone reports and turns its IP into an opaque hash.

export interface HeartbeatInput {
  continuousUsageMin: number;
  dnd: boolean;
}

/** Validates the body sent by the app; returns null when malformed. */
export function parseHeartbeat(body: unknown): HeartbeatInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { continuousUsageMin, dnd } = body as Record<string, unknown>;
  if (
    typeof continuousUsageMin !== 'number' ||
    !Number.isInteger(continuousUsageMin) ||
    continuousUsageMin < 0 ||
    continuousUsageMin > 1440 ||
    typeof dnd !== 'boolean'
  ) {
    return null;
  }
  return { continuousUsageMin, dnd };
}

/** The client IP as seen by the Edge Runtime (first hop of X-Forwarded-For). */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || null;
}

/**
 * HMAC-SHA256 of the IP with a server secret. Only this hash is stored: it is enough to tell that
 * two phones share a network, and cannot be reversed into the IP without the secret.
 */
export async function hashIp(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A mission is measured for at most 10 min (put down) + 120 min (cap): 3 h is enough. */
export const MEASUREMENT_MAX_AGE_MS = 3 * 60 * 60_000;

export interface RecentRun {
  id: string;
  sentAt: Date;
}

/**
 * The run the phone should measure off-phone minutes for, if any. Both partners received the
 * mission, so telling them when it was sent reveals nothing new.
 */
export function runToMeasure(latest: RecentRun | null, now: Date): RecentRun | null {
  if (!latest) return null;
  return now.getTime() - latest.sentAt.getTime() <= MEASUREMENT_MAX_AGE_MS ? latest : null;
}

export interface OffPhoneReport {
  runId: string;
  minutes: number;
}

export function parseOffPhoneReport(body: unknown): OffPhoneReport | null {
  if (typeof body !== 'object' || body === null) return null;
  const { runId, minutes } = body as Record<string, unknown>;
  if (
    typeof runId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(runId) ||
    typeof minutes !== 'number' ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 120
  ) {
    return null;
  }
  return { runId, minutes };
}
