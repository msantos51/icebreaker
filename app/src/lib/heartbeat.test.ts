import { describe, expect, it } from 'vitest';

import { buildHeartbeat } from './heartbeat';

const window = { timezone: 'Europe/Lisbon', windowStart: '19:00', windowEnd: '23:30' };
const t = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00Z`);

describe('buildHeartbeat', () => {
  it('sends nothing outside the window', () => {
    expect(buildHeartbeat(t('18:00'), window, [{ type: 'on', at: t('17:00') }], false)).toBeNull();
  });

  it('sends only the aggregated usage and DND', () => {
    expect(buildHeartbeat(t('21:00'), window, [{ type: 'on', at: t('20:35') }], true)).toEqual({
      continuousUsageMin: 25,
      dnd: true,
    });
  });

  it('reports 0 when the screen is off', () => {
    const events = [
      { type: 'on' as const, at: t('20:00') },
      { type: 'off' as const, at: t('20:30') },
    ];
    expect(buildHeartbeat(t('21:00'), window, events, false)).toEqual({
      continuousUsageMin: 0,
      dnd: false,
    });
  });
});
