import { describe, expect, it } from 'vitest';

import {
  type CoupleSettings,
  DEFAULT_SETTINGS,
  effectiveLevel,
  evaluateTrigger,
  type PartnerState,
  snoozeUntil,
  type TriggerInput,
  validateSettings,
} from './trigger.ts';

// All instants below are in winter (Lisbon = UTC), so local time equals the UTC time shown.
const settings: CoupleSettings = { ...DEFAULT_SETTINGS, timezone: 'Europe/Lisbon' };
const at = (hhmm: string, day = '2026-12-01') => new Date(`${day}T${hhmm}:00Z`);

const idle: PartnerState = { snoozedUntil: null, doNotDisturb: false, continuousUsageMin: null };
const scrolling: PartnerState = { ...idle, continuousUsageMin: 25 };

function manual(overrides: Partial<TriggerInput> = {}): TriggerInput {
  return {
    now: at('21:00'),
    source: 'manual',
    settings,
    partners: [idle, idle],
    together: false,
    previousRuns: [],
    ...overrides,
  };
}

function auto(overrides: Partial<TriggerInput> = {}): TriggerInput {
  return manual({ source: 'auto', together: true, partners: [scrolling, scrolling], ...overrides });
}

describe('evaluateTrigger: automatic trigger', () => {
  it('fires when every condition holds', () => {
    expect(evaluateTrigger(auto())).toEqual({ allowed: true, reasons: [] });
  });

  it('requires both partners to be together', () => {
    expect(evaluateTrigger(auto({ together: false })).reasons).toEqual(['not_together']);
  });

  it('requires both partners to be above the usage threshold', () => {
    const justBelow = { ...scrolling, continuousUsageMin: 19 };
    expect(evaluateTrigger(auto({ partners: [scrolling, justBelow] })).reasons).toEqual([
      'usage_below_threshold',
    ]);
    const exactly = { ...scrolling, continuousUsageMin: 20 };
    expect(evaluateTrigger(auto({ partners: [exactly, exactly] })).allowed).toBe(true);
  });

  it('treats unknown usage as below the threshold', () => {
    expect(evaluateTrigger(auto({ partners: [scrolling, idle] })).reasons).toEqual([
      'usage_below_threshold',
    ]);
  });

  it('respects a custom usage threshold', () => {
    const custom = { ...settings, usageThresholdMin: 30 };
    expect(evaluateTrigger(auto({ settings: custom })).reasons).toEqual(['usage_below_threshold']);
  });

  it.each([
    ['18:59', false],
    ['19:00', true],
    ['23:29', true],
    ['23:30', false],
    ['03:00', false],
  ])('only fires inside the window (%s -> %s)', (time, allowed) => {
    const decision = evaluateTrigger(auto({ now: at(time) }));
    expect(decision.allowed).toBe(allowed);
    if (!allowed) expect(decision.reasons).toEqual(['outside_window']);
  });

  it('supports a window that crosses midnight', () => {
    const late = { ...settings, windowStart: '22:00', windowEnd: '01:00' };
    expect(evaluateTrigger(auto({ settings: late, now: at('00:30', '2026-12-02') })).allowed).toBe(
      true,
    );
    expect(evaluateTrigger(auto({ settings: late, now: at('21:00') })).reasons).toEqual([
      'outside_window',
    ]);
  });

  it('uses the couple time zone for the window', () => {
    const saoPaulo = { ...settings, timezone: 'America/Sao_Paulo' }; // UTC-3
    expect(evaluateTrigger(auto({ settings: saoPaulo, now: at('21:00') })).reasons).toEqual([
      'outside_window',
    ]);
    expect(evaluateTrigger(auto({ settings: saoPaulo, now: at('23:00') })).allowed).toBe(true);
  });

  it('reports every failed condition', () => {
    const decision = evaluateTrigger(
      auto({ now: at('15:00'), together: false, partners: [idle, idle] }),
    );
    expect(decision).toEqual({
      allowed: false,
      reasons: ['outside_window', 'not_together', 'usage_below_threshold'],
    });
  });
});

describe('evaluateTrigger: manual trigger ("Estamos aborrecidos")', () => {
  it('fires without usage, presence or window conditions', () => {
    expect(evaluateTrigger(manual({ now: at('15:00') })).allowed).toBe(true);
  });
});

describe.each([
  ['manual', manual],
  ['auto', auto],
] as const)('evaluateTrigger: rules shared by %s triggers', (_source, make) => {
  it('is blocked while either partner said "hoje não"', () => {
    const snoozed = { ...scrolling, snoozedUntil: at('05:00', '2026-12-02') };
    expect(evaluateTrigger(make({ partners: [scrolling, snoozed] })).reasons).toEqual(['snoozed']);
    expect(evaluateTrigger(make({ partners: [snoozed, scrolling] })).reasons).toEqual(['snoozed']);
  });

  it('ignores an expired "hoje não"', () => {
    const expired = { ...scrolling, snoozedUntil: at('05:00') };
    expect(evaluateTrigger(make({ partners: [expired, scrolling] })).allowed).toBe(true);
  });

  it('is blocked while either partner is in Do Not Disturb', () => {
    const dnd = { ...scrolling, doNotDisturb: true };
    expect(evaluateTrigger(make({ partners: [dnd, scrolling] })).reasons).toEqual([
      'do_not_disturb',
    ]);
  });

  it('is blocked during the silence period after a mission', () => {
    expect(evaluateTrigger(make({ previousRuns: [at('20:01')] })).reasons).toEqual([
      'silence_period',
    ]);
    expect(evaluateTrigger(make({ previousRuns: [at('20:00')] })).allowed).toBe(true);
  });

  it('respects a custom silence period', () => {
    const longer = { ...settings, silencePeriodMin: 90 };
    expect(
      evaluateTrigger(make({ settings: longer, previousRuns: [at('19:45')] })).reasons,
    ).toEqual(['silence_period']);
  });

  it('allows at most 2 missions per night by default', () => {
    expect(evaluateTrigger(make({ previousRuns: [at('19:00')] })).allowed).toBe(true);
    expect(evaluateTrigger(make({ previousRuns: [at('19:00'), at('19:10')] })).reasons).toEqual([
      'night_limit_reached',
    ]);
  });

  it('respects a custom nightly limit', () => {
    const one = { ...settings, maxMissionsPerNight: 1 };
    expect(evaluateTrigger(make({ settings: one, previousRuns: [at('19:00')] })).reasons).toEqual([
      'night_limit_reached',
    ]);
  });

  it('counts the night across midnight and resets at 05:00', () => {
    const lastNight = [at('19:00'), at('22:00')];
    const late = { ...settings, windowStart: '22:00', windowEnd: '02:00' };
    expect(
      evaluateTrigger(make({ settings: late, previousRuns: lastNight, now: at('23:30') })).reasons,
    ).toEqual(['night_limit_reached']);
    expect(
      evaluateTrigger(
        make({ settings: late, previousRuns: lastNight, now: at('01:00', '2026-12-02') }),
      ).reasons,
    ).toEqual(['night_limit_reached']);
    expect(
      evaluateTrigger(make({ previousRuns: lastNight, now: at('21:00', '2026-12-02') })).allowed,
    ).toBe(true);
  });

  it('does not depend on the order of previous runs', () => {
    const runs = [at('19:00'), at('20:30'), at('19:00', '2026-11-30')];
    expect(evaluateTrigger(make({ previousRuns: runs })).reasons).toEqual([
      'night_limit_reached',
      'silence_period',
    ]);
  });
});

describe('snoozeUntil ("hoje não")', () => {
  it('lasts until 05:00 the next morning', () => {
    expect(snoozeUntil(at('20:00'), 'Europe/Lisbon')).toEqual(at('05:00', '2026-12-02'));
  });

  it('pressed after midnight still only covers the current night', () => {
    expect(snoozeUntil(at('00:30', '2026-12-02'), 'Europe/Lisbon')).toEqual(
      at('05:00', '2026-12-02'),
    );
  });

  it('pressed in the afternoon covers tonight', () => {
    expect(snoozeUntil(at('15:00'), 'Europe/Lisbon')).toEqual(at('05:00', '2026-12-02'));
  });
});

describe('effectiveLevel', () => {
  it('is the lower of the two levels (both must opt in)', () => {
    expect(effectiveLevel(1, 3)).toBe(1);
    expect(effectiveLevel(3, 2)).toBe(2);
    expect(effectiveLevel(2, 2)).toBe(2);
  });
});

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(settings)).toEqual([]);
  });

  it('accepts windows that cross midnight but not 05:00', () => {
    expect(validateSettings({ ...settings, windowStart: '22:00', windowEnd: '02:00' })).toEqual([]);
    expect(validateSettings({ ...settings, windowStart: '22:00', windowEnd: '05:00' })).toEqual([]);
    expect(validateSettings({ ...settings, windowStart: '22:00', windowEnd: '06:00' })).toEqual([
      'the window cannot include 05:00',
    ]);
    expect(validateSettings({ ...settings, windowStart: '04:00', windowEnd: '09:00' })).toEqual([
      'the window cannot include 05:00',
    ]);
  });

  it('rejects empty windows and invalid times', () => {
    expect(validateSettings({ ...settings, windowStart: '20:00', windowEnd: '20:00' })).toEqual([
      'the window cannot start and end at the same time',
    ]);
    expect(validateSettings({ ...settings, windowStart: '25:00' })).toEqual([
      'invalid clock time "25:00"',
    ]);
  });

  it('rejects invalid limits', () => {
    expect(validateSettings({ ...settings, maxMissionsPerNight: 0 })).toEqual([
      'maxMissionsPerNight must be a positive integer',
    ]);
  });
});
