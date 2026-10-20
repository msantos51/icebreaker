import { describe, expect, it } from 'vitest';

import { clientIp, hashIp, parseHeartbeat } from '../functions/_shared/presence.ts';

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
