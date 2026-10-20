import { describe, expect, it } from 'vitest';

import {
  clientIp,
  hashIp,
  parseHeartbeat,
  parseOffPhoneReport,
  runToMeasure,
} from '../functions/_shared/presence.ts';

describe('parseHeartbeat', () => {
  it('accepts valid input', () => {
    expect(parseHeartbeat({ continuousUsageMin: 25, dnd: false })).toEqual({
      continuousUsageMin: 25,
      dnd: false,
    });
  });

  it.each([
    null,
    'x',
    {},
    { continuousUsageMin: -1, dnd: false },
    { continuousUsageMin: 2.5, dnd: false },
    { continuousUsageMin: 2000, dnd: false },
    { continuousUsageMin: 5, dnd: 'no' },
  ])('rejects %j', (body) => {
    expect(parseHeartbeat(body)).toBeNull();
  });

  it('drops any extra field (only aggregated signals are kept)', () => {
    expect(parseHeartbeat({ continuousUsageMin: 5, dnd: true, apps: ['x'] })).toEqual({
      continuousUsageMin: 5,
      dnd: true,
    });
  });
});

describe('clientIp', () => {
  it('uses the first X-Forwarded-For hop', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '85.1.2.3, 10.0.0.1' }))).toBe('85.1.2.3');
    expect(clientIp(new Headers({ 'x-real-ip': '85.1.2.3' }))).toBe('85.1.2.3');
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('hashIp', () => {
  it('is deterministic per secret and does not contain the IP', async () => {
    const a = await hashIp('85.1.2.3', 'secret');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('85.1.2.3');
    expect(await hashIp('85.1.2.3', 'secret')).toBe(a);
    expect(await hashIp('85.1.2.4', 'secret')).not.toBe(a);
    expect(await hashIp('85.1.2.3', 'other')).not.toBe(a);
  });
});

describe('runToMeasure', () => {
  const now = new Date('2026-12-01T22:00:00Z');
  it('returns runs from the last 3 hours only', () => {
    const recent = { id: 'r1', sentAt: new Date('2026-12-01T19:30:00Z') };
    expect(runToMeasure(recent, now)).toEqual(recent);
    expect(runToMeasure({ id: 'r0', sentAt: new Date('2026-12-01T18:59:00Z') }, now)).toBeNull();
    expect(runToMeasure(null, now)).toBeNull();
  });
});

describe('parseOffPhoneReport', () => {
  const runId = '0b9f3a52-4a51-4f3c-9d3e-2a4c6e1f7b10';
  it('accepts a run id and 0-120 minutes', () => {
    expect(parseOffPhoneReport({ runId, minutes: 45 })).toEqual({ runId, minutes: 45 });
  });

  it.each([
    { runId: 'x', minutes: 5 },
    { runId, minutes: 121 },
    { runId, minutes: -1 },
    { runId, minutes: 1.5 },
    null,
  ])('rejects %j', (body) => {
    expect(parseOffPhoneReport(body)).toBeNull();
  });
});
