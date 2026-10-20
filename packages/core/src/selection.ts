import { type Mission, PARTNER_PLACEHOLDER } from './missions.ts';

/** Returns a float in [0, 1). Injected so that selection is deterministic in tests. */
export type Random = () => number;

export interface PreviousRun {
  missionId: string;
  sentAt: Date;
}

/**
 * Picks the next mission for a couple:
 * 1. only missions at or below the couple's effective level;
 * 2. never-sent missions first; once all were sent, the one sent longest ago;
 * 3. when possible, a different type from the last mission, so nights don't feel repetitive.
 * Returns null when the catalogue has no mission for this level.
 */
export function pickMission(
  catalogue: readonly Mission[],
  level: number,
  history: readonly PreviousRun[],
  random: Random = Math.random,
): Mission | null {
  const eligible = catalogue.filter((m) => m.level <= level);
  if (eligible.length === 0) return null;

  const lastSent = new Map<string, number>();
  for (const run of history) {
    const t = run.sentAt.getTime();
    if (t > (lastSent.get(run.missionId) ?? -Infinity)) lastSent.set(run.missionId, t);
  }

  let candidates = eligible.filter((m) => !lastSent.has(m.id));
  if (candidates.length === 0) {
    const oldest = Math.min(...eligible.map((m) => lastSent.get(m.id)!));
    candidates = eligible.filter((m) => lastSent.get(m.id) === oldest);
  }

  const lastRun = [...history].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
  const lastType = catalogue.find((m) => m.id === lastRun?.missionId)?.type;
  const otherType = candidates.filter((m) => m.type !== lastType);
  if (otherType.length > 0) candidates = otherType;

  return candidates[Math.floor(random() * candidates.length)] ?? candidates[0]!;
}

/** Randomly decides which partner gets message_a. */
export function assignRoles<T>(partners: readonly [T, T], random: Random = Math.random) {
  const [first, second] = partners;
  return random() < 0.5 ? { roleA: first, roleB: second } : { roleA: second, roleB: first };
}

/** Fills {parceiro} with the nickname the recipient uses for their partner. */
export function renderMessage(text: string, partnerNickname: string): string {
  return text.replaceAll(PARTNER_PLACEHOLDER, partnerNickname.trim());
}

/** The follow-up ("telemóveis em baixo") goes out as a second notification after this delay. */
export const FOLLOW_UP_DELAY_SECONDS = 60;
