// Orchestrates sending a mission to a couple. Runtime-agnostic (no Deno or Node APIs): the Edge
// Function provides the database and push implementations, and tests provide fakes.

import {
  assignRoles,
  type CoupleSettings,
  effectiveLevel,
  evaluateTrigger,
  FOLLOW_UP_DELAY_SECONDS,
  type Mission,
  pickMission,
  type PreviousRun,
  type Random,
  renderMessage,
  type TriggerDecision,
  type TriggerSource,
} from '@icebreaker/core';

export interface CoupleRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  level_a: number;
  level_b: number;
  timezone: string;
  window_start: string;
  window_end: string;
  usage_threshold_min: number;
  silence_period_min: number;
  max_missions_per_night: number;
}

export interface ProfileRow {
  id: string;
  partner_nickname: string | null;
  display_name: string | null;
  snoozed_until: string | null;
}

export interface PushToken {
  userId: string;
  token: string;
}

export interface MissionRepository {
  getCoupleForUser(userId: string): Promise<CoupleRow | null>;
  getProfiles(userIds: string[]): Promise<ProfileRow[]>;
  getRunHistory(coupleId: string): Promise<PreviousRun[]>;
  getActiveMissions(): Promise<Mission[]>;
  getPushTokens(userIds: string[]): Promise<PushToken[]>;
  /** Atomically records the run; null if another mission was started in the meantime. */
  startRun(run: {
    coupleId: string;
    missionId: string;
    roleAUserId: string;
    source: TriggerSource;
  }): Promise<string | null>;
  deletePushTokens(tokens: string[]): Promise<void>;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
}

export type PushResult = { ok: true } | { ok: false; deviceNotRegistered: boolean };

export interface PushSender {
  /** Sends all messages in a single request, so both partners get theirs at the same time. */
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

export const NOTIFICATION_TITLE = 'IceBreaker';

export type SendOutcome =
  | { status: 'sent'; runId: string; missionId: string }
  | { status: 'not_paired' }
  | { status: 'blocked'; reasons: TriggerDecision['reasons'] }
  | { status: 'unreachable' }
  | { status: 'no_mission' }
  | { status: 'race_lost' };

export interface SendMissionDeps {
  repo: MissionRepository;
  push: PushSender;
  now: () => Date;
  random?: Random;
  /** Runs `task` after `delayMs`, even after the HTTP response was sent. */
  schedule: (task: () => Promise<void>, delayMs: number) => void;
}

export function toSettings(couple: CoupleRow): CoupleSettings {
  return {
    timezone: couple.timezone,
    windowStart: couple.window_start,
    windowEnd: couple.window_end,
    usageThresholdMin: couple.usage_threshold_min,
    silencePeriodMin: couple.silence_period_min,
    maxMissionsPerNight: couple.max_missions_per_night,
  };
}

/** Handles "Estamos aborrecidos" pressed by `userId`. */
export async function sendManualMission(userId: string, deps: SendMissionDeps) {
  return sendMission(userId, 'manual', deps);
}

async function sendMission(
  userId: string,
  source: TriggerSource,
  { repo, push, now, random = Math.random, schedule }: SendMissionDeps,
): Promise<SendOutcome> {
  const couple = await repo.getCoupleForUser(userId);
  if (!couple) return { status: 'not_paired' };
  const partnerIds = [couple.user_a_id, couple.user_b_id] as const;

  const [profiles, history] = await Promise.all([
    repo.getProfiles([...partnerIds]),
    repo.getRunHistory(couple.id),
  ]);
  const profileOf = (id: string) => profiles.find((p) => p.id === id);

  const decision = evaluateTrigger({
    now: now(),
    source,
    settings: toSettings(couple),
    partners: [partnerState(profileOf(partnerIds[0])), partnerState(profileOf(partnerIds[1]))],
    // Phase 1 has no presence or usage detection: these only matter for automatic triggers.
    together: false,
    previousRuns: history.map((r) => r.sentAt),
  });
  if (!decision.allowed) return { status: 'blocked', reasons: decision.reasons };

  const tokens = await repo.getPushTokens([...partnerIds]);
  const tokensOf = (id: string) => tokens.filter((t) => t.userId === id).map((t) => t.token);
  if (partnerIds.some((id) => tokensOf(id).length === 0)) return { status: 'unreachable' };

  const mission = pickMission(
    await repo.getActiveMissions(),
    effectiveLevel(couple.level_a, couple.level_b),
    history,
    random,
  );
  if (!mission) return { status: 'no_mission' };

  const { roleA, roleB } = assignRoles(partnerIds, random);
  const runId = await repo.startRun({
    coupleId: couple.id,
    missionId: mission.id,
    roleAUserId: roleA,
    source,
  });
  if (!runId) return { status: 'race_lost' };

  const forUser = (id: string, text: string): PushMessage[] => {
    const partner = profileOf(id === roleA ? roleB : roleA);
    const nickname = profileOf(id)?.partner_nickname ?? partner?.display_name ?? '';
    return tokensOf(id).map((to) => ({
      to,
      title: NOTIFICATION_TITLE,
      body: renderMessage(text, nickname),
    }));
  };

  await deliver(repo, push, [
    ...forUser(roleA, mission.message_a),
    ...forUser(roleB, mission.message_b),
  ]);

  schedule(async () => {
    await deliver(repo, push, [
      ...forUser(roleA, mission.follow_up),
      ...forUser(roleB, mission.follow_up),
    ]);
  }, FOLLOW_UP_DELAY_SECONDS * 1000);

  return { status: 'sent', runId, missionId: mission.id };
}

function partnerState(profile: ProfileRow | undefined) {
  return {
    snoozedUntil: profile?.snoozed_until ? new Date(profile.snoozed_until) : null,
    doNotDisturb: false,
    continuousUsageMin: null,
  };
}

/** Sends the messages and forgets tokens of uninstalled apps. */
async function deliver(repo: MissionRepository, push: PushSender, messages: PushMessage[]) {
  const results = await push.send(messages);
  const stale = messages
    .filter((_, i) => {
      const result = results[i];
      return result && !result.ok && result.deviceNotRegistered;
    })
    .map((m) => m.to);
  if (stale.length > 0) await repo.deletePushTokens(stale);
}
