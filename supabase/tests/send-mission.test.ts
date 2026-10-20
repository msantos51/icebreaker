import type { Mission, PreviousRun } from '@icebreaker/core';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type CoupleRow,
  type MissionRepository,
  type PresenceRow,
  type ProfileRow,
  type PushMessage,
  type PushResult,
  sendAutoMission,
  sendManualMission,
  type SendMissionDeps,
} from '../functions/_shared/send-mission.ts';

const ALICE = 'alice';
const BOB = 'bob';
const NOW = new Date('2026-12-01T21:00:00Z');

const couple: CoupleRow = {
  id: 'couple-1',
  user_a_id: ALICE,
  user_b_id: BOB,
  level_a: 1,
  level_b: 1,
  timezone: 'Europe/Lisbon',
  window_start: '19:00:00',
  window_end: '23:30:00',
  usage_threshold_min: 20,
  silence_period_min: 60,
  max_missions_per_night: 2,
};

const joke: Mission = {
  id: 'aa_joke',
  type: 'actor_audience',
  level: 1,
  tags: [],
  message_a: 'Conta uma piada a {parceiro}.',
  message_b: '{parceiro} vai contar-te uma piada. Ri-te muito.',
  follow_up: 'Telemóveis em baixo.',
};

class FakeRepo implements MissionRepository {
  couple: CoupleRow | null = couple;
  profiles: ProfileRow[] = [
    { id: ALICE, display_name: 'Alice', partner_nickname: 'Bobby', snoozed_until: null },
    { id: BOB, display_name: 'Bob', partner_nickname: 'Lice', snoozed_until: null },
  ];
  history: PreviousRun[] = [];
  missions: Mission[] = [joke];
  tokens = [
    { userId: ALICE, token: 'alice-phone' },
    { userId: BOB, token: 'bob-phone' },
  ];
  presence: PresenceRow[] = [];
  runs: { coupleId: string; missionId: string; roleAUserId: string; source: string }[] = [];
  deleted: string[] = [];
  raceLost = false;

  async getCoupleForUser(userId: string) {
    return this.couple && [this.couple.user_a_id, this.couple.user_b_id].includes(userId)
      ? this.couple
      : null;
  }
  async getProfiles() {
    return this.profiles;
  }
  async getRunHistory() {
    return this.history;
  }
  async getActiveMissions() {
    return this.missions;
  }
  async getPushTokens(userIds: string[]) {
    return this.tokens.filter((t) => userIds.includes(t.userId));
  }
  async getPresence(userIds: string[]) {
    return this.presence.filter((p) => userIds.includes(p.userId));
  }
  async startRun(run: {
    coupleId: string;
    missionId: string;
    roleAUserId: string;
    source: string;
  }) {
    if (this.raceLost) return null;
    this.runs.push(run);
    return `run-${this.runs.length}`;
  }
  async deletePushTokens(tokens: string[]) {
    this.deleted.push(...tokens);
  }
}

class FakePush {
  batches: PushMessage[][] = [];
  results: (message: PushMessage) => PushResult = () => ({ ok: true });
  async send(messages: PushMessage[]) {
    this.batches.push(messages);
    return messages.map(this.results);
  }
}

let repo: FakeRepo;
let push: FakePush;
let scheduled: { task: () => Promise<void>; delayMs: number }[];
let deps: SendMissionDeps;

beforeEach(() => {
  repo = new FakeRepo();
  push = new FakePush();
  scheduled = [];
  deps = {
    repo,
    push,
    now: () => NOW,
    random: () => 0, // ALICE gets role A
    schedule: (task, delayMs) => scheduled.push({ task, delayMs }),
  };
});

describe('sendManualMission', () => {
  it('sends each partner their half, in a single push request', async () => {
    const outcome = await sendManualMission(BOB, deps);
    expect(outcome).toEqual({ status: 'sent', runId: 'run-1', missionId: 'aa_joke' });
    expect(push.batches).toEqual([
      [
        { to: 'alice-phone', title: 'IceBreaker', body: 'Conta uma piada a Bobby.' },
        {
          to: 'bob-phone',
          title: 'IceBreaker',
          body: 'Lice vai contar-te uma piada. Ri-te muito.',
        },
      ],
    ]);
    expect(repo.runs).toEqual([
      { coupleId: 'couple-1', missionId: 'aa_joke', roleAUserId: ALICE, source: 'manual' },
    ]);
  });

  it('sends the follow-up to both a minute later', async () => {
    await sendManualMission(ALICE, deps);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.delayMs).toBe(60_000);
    await scheduled[0]!.task();
    expect(push.batches[1]).toEqual([
      { to: 'alice-phone', title: 'IceBreaker', body: 'Telemóveis em baixo.' },
      { to: 'bob-phone', title: 'IceBreaker', body: 'Telemóveis em baixo.' },
    ]);
  });

  it('sends to every device of each partner', async () => {
    repo.tokens.push({ userId: BOB, token: 'bob-tablet' });
    await sendManualMission(ALICE, deps);
    expect(push.batches[0]!.map((m) => m.to)).toEqual(['alice-phone', 'bob-phone', 'bob-tablet']);
  });

  it('does nothing when the user is not paired', async () => {
    repo.couple = null;
    expect(await sendManualMission(ALICE, deps)).toEqual({ status: 'not_paired' });
    expect(push.batches).toEqual([]);
  });

  it('respects the partner\'s "hoje não"', async () => {
    repo.profiles[1]!.snoozed_until = '2026-12-02T05:00:00Z';
    expect(await sendManualMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['snoozed'],
    });
    expect(push.batches).toEqual([]);
    expect(repo.runs).toEqual([]);
  });

  it('respects the silence period and the nightly limit', async () => {
    repo.history = [{ missionId: 'aa_joke', sentAt: new Date('2026-12-01T20:30:00Z') }];
    expect(await sendManualMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['silence_period'],
    });
    repo.history = [
      { missionId: 'aa_joke', sentAt: new Date('2026-12-01T18:00:00Z') },
      { missionId: 'aa_joke', sentAt: new Date('2026-12-01T19:00:00Z') },
    ];
    expect(await sendManualMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['night_limit_reached'],
    });
  });

  it('does not send half a mission when a partner has no device registered', async () => {
    repo.tokens = repo.tokens.filter((t) => t.userId !== BOB);
    expect(await sendManualMission(ALICE, deps)).toEqual({ status: 'unreachable' });
    expect(push.batches).toEqual([]);
    expect(repo.runs).toEqual([]);
  });

  it('only uses missions both partners opted in to', async () => {
    repo.missions = [{ ...joke, id: 'spicy', level: 2 }];
    expect(await sendManualMission(ALICE, deps)).toEqual({ status: 'no_mission' });
    repo.couple = { ...couple, level_a: 2, level_b: 2 };
    expect(await sendManualMission(ALICE, deps)).toMatchObject({ status: 'sent' });
  });

  it('sends nothing when the other partner started a mission at the same time', async () => {
    repo.raceLost = true;
    expect(await sendManualMission(ALICE, deps)).toEqual({ status: 'race_lost' });
    expect(push.batches).toEqual([]);
  });

  it('forgets tokens of uninstalled apps', async () => {
    push.results = (m) =>
      m.to === 'bob-phone' ? { ok: false, deviceNotRegistered: true } : { ok: true };
    await sendManualMission(ALICE, deps);
    expect(repo.deleted).toEqual(['bob-phone']);
  });
});

describe('sendAutoMission', () => {
  const seen = (userId: string, overrides: Partial<PresenceRow> = {}): PresenceRow => ({
    userId,
    publicIpHash: 'home',
    continuousUsageMin: 25,
    dnd: false,
    updatedAt: new Date('2026-12-01T20:55:00Z'),
    ...overrides,
  });

  it('fires when both are home, scrolling for 20+ minutes, inside the window', async () => {
    repo.presence = [seen(ALICE), seen(BOB)];
    expect(await sendAutoMission(ALICE, deps)).toMatchObject({ status: 'sent' });
    expect(repo.runs[0]!.source).toBe('auto');
  });

  it('needs both phones on the same network', async () => {
    repo.presence = [seen(ALICE), seen(BOB, { publicIpHash: 'office' })];
    expect(await sendAutoMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['not_together'],
    });
  });

  it('needs both above the usage threshold', async () => {
    repo.presence = [seen(ALICE), seen(BOB, { continuousUsageMin: 5 })];
    expect(await sendAutoMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['usage_below_threshold'],
    });
  });

  it('ignores stale heartbeats', async () => {
    repo.presence = [seen(ALICE), seen(BOB, { updatedAt: new Date('2026-12-01T20:00:00Z') })];
    expect(await sendAutoMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['not_together', 'usage_below_threshold'],
    });
  });

  it('never fires for a partner without presence (e.g. an iPhone before Phase 3)', async () => {
    repo.presence = [seen(ALICE)];
    expect(await sendAutoMission(ALICE, deps)).toMatchObject({ status: 'blocked' });
    expect(push.batches).toEqual([]);
  });

  it('respects Do Not Disturb, for automatic and manual triggers', async () => {
    repo.presence = [seen(ALICE), seen(BOB, { dnd: true })];
    expect(await sendAutoMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['do_not_disturb'],
    });
    expect(await sendManualMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['do_not_disturb'],
    });
  });

  it('only fires inside the window', async () => {
    repo.presence = [
      seen(ALICE, { updatedAt: new Date('2026-12-01T15:55:00Z') }),
      seen(BOB, { updatedAt: new Date('2026-12-01T15:55:00Z') }),
    ];
    deps.now = () => new Date('2026-12-01T16:00:00Z');
    expect(await sendAutoMission(ALICE, deps)).toEqual({
      status: 'blocked',
      reasons: ['outside_window'],
    });
  });
});
